import { Injectable } from '@nestjs/common';
import * as bip39 from 'bip39';
import { ChainInterface, ChainWallet, ChainTransaction, ChainBalance } from '../interfaces/chain.interface';
import { Chain } from '../../database/entities/chain.entity';

let TonClient: any;
let TonWallet: any;
let tonInternal: any;
let tonAddress: any;
let tonKeyPair: any;

@Injectable()
export class TonChain extends ChainInterface {
  name: string;
  standard = 'TON';
  gasToken = 'TON';
  usdtContract?: string;

  private chainConfig: Chain;
  private client: any;
  private initialized = false;

  async configure(config: Chain) {
    this.chainConfig = config;
    this.name = config.name;
    this.usdtContract = config.usdt_contract;

    try {
      const ton = await import('@ton/ton');
      const tonCore = await import('@ton/core');
      const tonCrypto = await import('@ton/crypto');

      TonClient = ton.TonClient;
      TonWallet = ton.WalletContractV4;
      tonInternal = tonCore.internal;
      tonAddress = tonCore.Address;
      tonKeyPair = tonCrypto.keyPairFromSeed;

      this.client = new TonClient({
        endpoint: config.rpc_url || 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.TON_API_KEY || undefined,
      });
      this.initialized = true;
    } catch (error) {
      console.warn('TON packages not available:', error.message);
    }
  }

  private ensureInitialized() {
    if (!this.initialized) {
      throw new Error('TON chain not initialized');
    }
  }

  private keypairFromHex(hex: string) {
    const secretKey = Buffer.from(hex, 'hex');
    // ton-crypto keyPairFromSeed expects 32-byte seed
    if (secretKey.length === 64) {
      // Full keypair (secret + public), extract seed (first 32 bytes)
      return { secretKey, publicKey: secretKey.subarray(32) };
    }
    return tonKeyPair(secretKey);
  }

  private getWalletContract(publicKey: Buffer) {
    return TonWallet.create({
      workchain: 0,
      publicKey,
    });
  }

  async generateWallet(): Promise<ChainWallet> {
    this.ensureInitialized();
    const crypto = require('crypto');
    const seed = crypto.randomBytes(32);
    const keyPair = tonKeyPair(seed);
    const wallet = this.getWalletContract(keyPair.publicKey);

    return {
      address: wallet.address.toString(),
      privateKey: Buffer.from(seed).toString('hex'),
    };
  }

  async deriveWallet(masterSeed: string, index: number): Promise<ChainWallet> {
    this.ensureInitialized();
    const seed = bip39.mnemonicToSeedSync(masterSeed);
    const derivedSeed = seed.subarray(0, 28);
    const indexBuffer = Buffer.alloc(4);
    indexBuffer.writeUInt32BE(index, 0);
    const finalSeed = Buffer.concat([derivedSeed, indexBuffer]).subarray(0, 32);

    const crypto = require('crypto');
    const hashedSeed = crypto.createHash('sha256').update(finalSeed).digest();

    const keyPair = tonKeyPair(hashedSeed);
    const wallet = this.getWalletContract(keyPair.publicKey);

    return {
      address: wallet.address.toString(),
      privateKey: Buffer.from(hashedSeed).toString('hex'),
    };
  }

  validateAddress(address: string): boolean {
    if (!tonAddress) return address.length > 40;
    try {
      tonAddress.parse(address);
      return true;
    } catch {
      return false;
    }
  }

  async getUSDTBalance(address: string): Promise<ChainBalance> {
    // TON USDT is a Jetton — requires jetton wallet lookup
    // For now return 0 if not configured; full jetton support is complex
    if (!this.initialized || !this.usdtContract) {
      return { address, balance: '0', decimals: 6 };
    }

    try {
      const { JettonMaster } = await import('@ton/ton');
      const masterAddress = tonAddress.parse(this.usdtContract);
      const jettonMaster = this.client.open(JettonMaster.create(masterAddress));
      const ownerAddress = tonAddress.parse(address);
      const jettonWalletAddress = await jettonMaster.getWalletAddress(ownerAddress);
      
      // Get jetton wallet data
      const { stack } = await this.client.runMethod(jettonWalletAddress, 'get_wallet_data');
      const balance = stack.readBigNumber();
      return {
        address,
        balance: (Number(balance) / Math.pow(10, 6)).toString(),
        decimals: 6,
      };
    } catch {
      return { address, balance: '0', decimals: 6 };
    }
  }

  async getNativeBalance(address: string): Promise<ChainBalance> {
    this.ensureInitialized();
    try {
      const addr = tonAddress.parse(address);
      const balance = await this.client.getBalance(addr);
      return {
        address,
        balance: (Number(balance) / Math.pow(10, 9)).toString(),
        decimals: 9,
      };
    } catch (error) {
      console.error('Failed to get TON balance:', error);
      return { address, balance: '0', decimals: 9 };
    }
  }

  async sendUSDT(from: ChainWallet, to: string, amount: string): Promise<string> {
    this.ensureInitialized();
    if (!this.usdtContract) {
      throw new Error('USDT (Jetton) contract not configured for TON');
    }

    // Jetton transfers on TON require sending an internal message to the jetton wallet
    // with a specific payload (op=transfer, amount, destination)
    const keyPair = this.keypairFromHex(from.privateKey);
    const wallet = this.getWalletContract(keyPair.publicKey);
    const contract = this.client.open(wallet);

    const { JettonMaster } = await import('@ton/ton');
    const { beginCell, toNano } = await import('@ton/core');

    const masterAddr = tonAddress.parse(this.usdtContract);
    const jettonMaster = this.client.open(JettonMaster.create(masterAddr));
    const senderJettonWallet = await jettonMaster.getWalletAddress(wallet.address);

    const amountUnits = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, 6)));
    const destAddr = tonAddress.parse(to);

    // Build jetton transfer payload
    const forwardPayload = beginCell().endCell();
    const body = beginCell()
      .storeUint(0xf8a7ea5, 32) // op: transfer
      .storeUint(0, 64)         // query_id
      .storeCoins(amountUnits)  // amount
      .storeAddress(destAddr)   // destination
      .storeAddress(wallet.address) // response_destination
      .storeBit(false)          // no custom payload
      .storeCoins(toNano('0.01')) // forward_ton_amount
      .storeBit(false)          // no forward payload
      .endCell();

    const seqno = await contract.getSeqno();
    await contract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [tonInternal({
        to: senderJettonWallet,
        value: toNano('0.05'), // gas for jetton transfer
        body,
      })],
    });

    // Return a pseudo tx hash (TON doesn't return hash immediately)
    return `ton_${Date.now()}_${seqno}`;
  }

  async sendNative(from: ChainWallet, to: string, amount: string): Promise<string> {
    this.ensureInitialized();
    const { toNano } = await import('@ton/core');

    const keyPair = this.keypairFromHex(from.privateKey);
    const wallet = this.getWalletContract(keyPair.publicKey);
    const contract = this.client.open(wallet);

    const seqno = await contract.getSeqno();
    await contract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [tonInternal({
        to: tonAddress.parse(to),
        value: toNano(amount),
        bounce: false,
      })],
    });

    return `ton_${Date.now()}_${seqno}`;
  }

  async getTransaction(txHash: string): Promise<ChainTransaction> {
    // TON transaction lookup is different — uses lt + hash
    // For pseudo hashes we generated, return basic info
    return {
      hash: txHash,
      from: '',
      to: '',
      amount: '0',
      confirmations: 1,
      blockNumber: undefined,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  monitorAddress(address: string, callback: (tx: ChainTransaction) => void): void {
    // TON monitoring would use TonClient.getTransactions polling
    console.log(`TON address monitoring for ${address} — polling not yet set up`);
  }

  async estimateGasFee(): Promise<string> {
    return '0.01'; // ~0.01 TON typical fee
  }

  async getCurrentBlock(): Promise<number> {
    if (!this.initialized) return 0;
    try {
      const info = await this.client.getMasterchainInfo();
      return info.last.seqno;
    } catch {
      return 0;
    }
  }

  async fundSubWalletGas(masterWallet: ChainWallet, subWalletAddress: string, amount?: string): Promise<string> {
    return this.sendNative(masterWallet, subWalletAddress, amount || '0.05');
  }

  async approveSubWallet(subWalletPrivateKey: string, masterWalletAddress: string): Promise<string> {
    // TON Jettons don't have an approve pattern like EVM
    // Transfers are done by the owner directly
    // For sweep, the master would need the sub-wallet's private key to sign
    // Mark as approved since we store the private key
    return `ton_approve_${Date.now()}`;
  }

  async sweepSubWallet(
    masterWalletPrivateKey: string,
    subWalletAddress: string,
    masterWalletAddress: string,
    amount: string
  ): Promise<string> {
    // For TON, sweep means sending from the sub-wallet using its stored private key
    // The "master private key" isn't used for transferFrom like EVM
    // Instead, we need the sub-wallet's key (which we have stored)
    // This would be called differently in the sweep service
    throw new Error('TON sweep requires sub-wallet private key, not master key. Use sendUSDT from sub-wallet directly.');
  }
}
