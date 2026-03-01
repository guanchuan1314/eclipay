import { Injectable } from '@nestjs/common';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, getAccount, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import * as bip39 from 'bip39';
import { ChainInterface, ChainWallet, ChainTransaction, ChainBalance } from '../interfaces/chain.interface';
import { Chain } from '../../database/entities/chain.entity';

@Injectable()
export class SolanaChain extends ChainInterface {
  name: string;
  standard = 'SOLANA';
  gasToken = 'SOL';
  usdtContract?: string;
  
  private chainConfig: Chain;
  private connection: Connection;

  configure(config: Chain) {
    this.chainConfig = config;
    this.name = config.name;
    this.usdtContract = config.usdt_contract;
    this.connection = new Connection(config.rpc_url, 'confirmed');
  }

  private keypairFromHex(hex: string): Keypair {
    return Keypair.fromSecretKey(Buffer.from(hex, 'hex'));
  }

  async generateWallet(): Promise<ChainWallet> {
    const keypair = Keypair.generate();
    return {
      address: keypair.publicKey.toString(),
      privateKey: Buffer.from(keypair.secretKey).toString('hex'),
    };
  }

  async deriveWallet(masterSeed: string, index: number): Promise<ChainWallet> {
    const seed = bip39.mnemonicToSeedSync(masterSeed);
    const derivedSeed = seed.subarray(0, 28);
    const indexBuffer = Buffer.alloc(4);
    indexBuffer.writeUInt32BE(index, 0);
    const finalSeed = Buffer.concat([derivedSeed, indexBuffer]);
    const crypto = require('crypto');
    const hashedSeed = crypto.createHash('sha256').update(finalSeed).digest().subarray(0, 32);
    const keypair = Keypair.fromSeed(hashedSeed);
    return {
      address: keypair.publicKey.toString(),
      privateKey: Buffer.from(keypair.secretKey).toString('hex'),
    };
  }

  validateAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  async getUSDTBalance(address: string): Promise<ChainBalance> {
    if (!this.usdtContract) {
      return { address, balance: '0', decimals: 6 };
    }

    try {
      const owner = new PublicKey(address);
      const mint = new PublicKey(this.usdtContract);
      const ata = getAssociatedTokenAddressSync(mint, owner);
      const account = await getAccount(this.connection, ata);
      const balance = Number(account.amount) / Math.pow(10, 6);
      return { address, balance: balance.toString(), decimals: 6 };
    } catch (error) {
      // Account doesn't exist = 0 balance
      return { address, balance: '0', decimals: 6 };
    }
  }

  async getNativeBalance(address: string): Promise<ChainBalance> {
    const publicKey = new PublicKey(address);
    const balance = await this.connection.getBalance(publicKey);
    return {
      address,
      balance: (balance / LAMPORTS_PER_SOL).toString(),
      decimals: 9,
    };
  }

  async sendUSDT(from: ChainWallet, to: string, amount: string): Promise<string> {
    if (!this.usdtContract) {
      throw new Error('USDT contract not configured for this chain');
    }

    const fromKeypair = this.keypairFromHex(from.privateKey);
    const mint = new PublicKey(this.usdtContract);
    const toPubkey = new PublicKey(to);

    const fromAta = getAssociatedTokenAddressSync(mint, fromKeypair.publicKey);
    const toAta = getAssociatedTokenAddressSync(mint, toPubkey);

    const amountLamports = Math.floor(parseFloat(amount) * Math.pow(10, 6));

    const transaction = new Transaction();

    // Check if destination ATA exists, create if not
    try {
      await getAccount(this.connection, toAta);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromKeypair.publicKey, // payer
          toAta,
          toPubkey,
          mint,
        )
      );
    }

    transaction.add(
      createTransferInstruction(
        fromAta,
        toAta,
        fromKeypair.publicKey,
        amountLamports,
      )
    );

    const signature = await sendAndConfirmTransaction(this.connection, transaction, [fromKeypair]);
    return signature;
  }

  async sendNative(from: ChainWallet, to: string, amount: string): Promise<string> {
    const fromKeypair = this.keypairFromHex(from.privateKey);
    const toPubkey = new PublicKey(to);
    const lamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey,
        lamports,
      })
    );

    const signature = await sendAndConfirmTransaction(this.connection, transaction, [fromKeypair]);
    return signature;
  }

  async getTransaction(txHash: string): Promise<ChainTransaction> {
    const tx = await this.connection.getTransaction(txHash, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      throw new Error('Transaction not found');
    }

    const slot = await this.connection.getSlot();
    const confirmations = tx.slot ? slot - tx.slot : 0;

    return {
      hash: txHash,
      from: tx.transaction.message.getAccountKeys().get(0)?.toString() || '',
      to: tx.transaction.message.getAccountKeys().get(1)?.toString() || '',
      amount: ((tx.meta?.postBalances?.[1] || 0) - (tx.meta?.preBalances?.[1] || 0)).toString(),
      confirmations,
      blockNumber: tx.slot,
      timestamp: tx.blockTime || undefined,
    };
  }

  monitorAddress(address: string, callback: (tx: ChainTransaction) => void): void {
    const pubkey = new PublicKey(address);
    this.connection.onAccountChange(pubkey, async (accountInfo, context) => {
      try {
        const sigs = await this.connection.getSignaturesForAddress(pubkey, { limit: 1 });
        if (sigs.length > 0) {
          const tx = await this.getTransaction(sigs[0].signature);
          callback(tx);
        }
      } catch (error) {
        console.error('Error in Solana address monitor:', error);
      }
    });
  }

  async estimateGasFee(): Promise<string> {
    try {
      const { feeCalculator } = await this.connection.getRecentBlockhash();
      return ((feeCalculator as any)?.lamportsPerSignature / LAMPORTS_PER_SOL || 0.000005).toString();
    } catch {
      return '0.000005';
    }
  }

  async getCurrentBlock(): Promise<number> {
    return await this.connection.getSlot();
  }

  async fundSubWalletGas(masterWallet: ChainWallet, subWalletAddress: string, amount?: string): Promise<string> {
    // Send SOL for rent-exempt ATA creation + tx fees
    const sendAmount = amount || '0.01'; // ~0.01 SOL covers ATA rent + fees
    return this.sendNative(masterWallet, subWalletAddress, sendAmount);
  }

  async approveSubWallet(subWalletPrivateKey: string, masterWalletAddress: string): Promise<string> {
    // Solana SPL tokens use delegate/approve pattern
    if (!this.usdtContract) {
      throw new Error('USDT contract not configured');
    }

    const { createApproveInstruction } = require('@solana/spl-token');
    const subKeypair = this.keypairFromHex(subWalletPrivateKey);
    const mint = new PublicKey(this.usdtContract);
    const masterPubkey = new PublicKey(masterWalletAddress);
    const subAta = getAssociatedTokenAddressSync(mint, subKeypair.publicKey);

    const transaction = new Transaction().add(
      createApproveInstruction(
        subAta,
        masterPubkey,
        subKeypair.publicKey,
        BigInt('18446744073709551615'), // max u64
      )
    );

    const signature = await sendAndConfirmTransaction(this.connection, transaction, [subKeypair]);
    return signature;
  }

  async sweepSubWallet(
    masterWalletPrivateKey: string,
    subWalletAddress: string,
    masterWalletAddress: string,
    amount: string
  ): Promise<string> {
    if (!this.usdtContract) {
      throw new Error('USDT contract not configured');
    }

    const { createTransferCheckedInstruction } = require('@solana/spl-token');
    const masterKeypair = this.keypairFromHex(masterWalletPrivateKey);
    const mint = new PublicKey(this.usdtContract);
    const subPubkey = new PublicKey(subWalletAddress);
    const masterPubkey = new PublicKey(masterWalletAddress);

    const subAta = getAssociatedTokenAddressSync(mint, subPubkey);
    const masterAta = getAssociatedTokenAddressSync(mint, masterPubkey);

    const amountLamports = Math.floor(parseFloat(amount) * Math.pow(10, 6));

    const transaction = new Transaction();

    // Ensure master ATA exists
    try {
      await getAccount(this.connection, masterAta);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          masterKeypair.publicKey,
          masterAta,
          masterPubkey,
          mint,
        )
      );
    }

    transaction.add(
      createTransferCheckedInstruction(
        subAta,           // source
        mint,             // mint
        masterAta,        // destination
        masterKeypair.publicKey, // authority (delegate)
        amountLamports,
        6,                // decimals
      )
    );

    const signature = await sendAndConfirmTransaction(this.connection, transaction, [masterKeypair]);
    return signature;
  }
}
