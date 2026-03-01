import { Injectable } from '@nestjs/common';
import * as bip39 from 'bip39';
import { ChainInterface, ChainWallet, ChainTransaction, ChainBalance } from '../interfaces/chain.interface';
import { Chain } from '../../database/entities/chain.entity';

// Note: TronWeb will be dynamically imported to handle installation timing
let TronWeb: any;

@Injectable()
export class TronChain extends ChainInterface {
  name: string;
  standard = 'TRON';
  gasToken = 'TRX';
  usdtContract?: string;
  
  private chainConfig: Chain;
  private tronWeb: any;

  async configure(config: Chain) {
    this.chainConfig = config;
    this.name = config.name;
    this.usdtContract = config.usdt_contract;
    
    // Dynamic import to handle installation timing
    if (!TronWeb) {
      try {
        const tronWebModule = await import('tronweb');
        TronWeb = tronWebModule.TronWeb || tronWebModule.default || tronWebModule;
      } catch (error) {
        console.warn('TronWeb not available, skipping TRON functionality');
        // Don't initialize tronWeb if the package is not available
        return;
      }
    }
    
    if (TronWeb) {
      try {
        const TronWebConstructor = TronWeb.TronWeb || TronWeb.default || TronWeb;
        this.tronWeb = new TronWebConstructor({
          fullHost: config.rpc_url,
        });
      } catch (error) {
        console.warn('Failed to initialize TronWeb:', error.message);
        this.tronWeb = null;
      }
    }
  }

  async generateWallet(): Promise<ChainWallet> {
    if (!this.tronWeb || !TronWeb) {
      throw new Error('TronWeb not initialized. Please install tronweb package.');
    }
    
    const account = await this.tronWeb.createAccount();
    return {
      address: account.address.base58,
      privateKey: account.privateKey,
    };
  }

  async deriveWallet(masterSeed: string, index: number): Promise<ChainWallet> {
    if (!this.tronWeb || !TronWeb) {
      throw new Error('TronWeb not initialized. Please install tronweb package.');
    }
    
    const seed = bip39.mnemonicToSeedSync(masterSeed);
    // Generate private key from seed and index
    const derivedSeed = seed.subarray(0, 32); // Use first 32 bytes
    const indexBuffer = Buffer.alloc(4);
    indexBuffer.writeUInt32BE(index, 0);
    const privateKeyBuffer = Buffer.concat([derivedSeed, indexBuffer]).subarray(0, 32);
    const privateKey = privateKeyBuffer.toString('hex');
    
    const address = this.tronWeb.address.fromPrivateKey(privateKey);
    return {
      address,
      privateKey,
    };
  }

  validateAddress(address: string): boolean {
    if (!this.tronWeb || !TronWeb) {
      // Basic validation if TronWeb not available
      return address.startsWith('T') && address.length === 34;
    }
    
    return this.tronWeb.isAddress(address);
  }

  async getUSDTBalance(address: string): Promise<ChainBalance> {
    if (!this.tronWeb || !TronWeb || !this.usdtContract) {
      throw new Error('TronWeb not initialized or USDT contract not configured');
    }

    try {
      const contract = await this.tronWeb.contract().at(this.usdtContract);
      const balance = await contract.balanceOf(address).call();
      
      return {
        address,
        balance: (balance / Math.pow(10, 6)).toString(), // USDT has 6 decimals on TRON
        decimals: 6,
      };
    } catch (error) {
      console.error('Failed to get Tron USDT balance:', error);
      return {
        address,
        balance: '0',
        decimals: 6,
      };
    }
  }

  async getNativeBalance(address: string): Promise<ChainBalance> {
    if (!this.tronWeb || !TronWeb) {
      throw new Error('TronWeb not initialized');
    }

    try {
      const balance = await this.tronWeb.trx.getBalance(address);
      
      return {
        address,
        balance: (balance / Math.pow(10, 6)).toString(), // TRX has 6 decimals
        decimals: 6,
      };
    } catch (error) {
      console.error('Failed to get Tron native balance:', error);
      return {
        address,
        balance: '0',
        decimals: 6,
      };
    }
  }

  async sendUSDT(from: ChainWallet, to: string, amount: string): Promise<string> {
    if (!this.tronWeb || !TronWeb || !this.usdtContract) {
      throw new Error('TronWeb not initialized or USDT contract not configured');
    }

    try {
      this.tronWeb.setPrivateKey(from.privateKey);
      const contract = await this.tronWeb.contract().at(this.usdtContract);
      const amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, 6));
      const result = await contract.transfer(to, amountInSmallestUnit).send();
      return result;
    } catch (error) {
      console.error('Failed to send Tron USDT:', error);
      throw error;
    }
  }

  async sendNative(from: ChainWallet, to: string, amount: string): Promise<string> {
    if (!this.tronWeb || !TronWeb) {
      throw new Error('TronWeb not initialized');
    }

    try {
      this.tronWeb.setPrivateKey(from.privateKey);
      const amountSun = Math.floor(parseFloat(amount) * Math.pow(10, 6)); // TRX uses 6 decimals (sun)
      const transaction = await this.tronWeb.transactionBuilder.sendTrx(to, amountSun, from.address);
      const signedTransaction = await this.tronWeb.trx.sign(transaction);
      const result = await this.tronWeb.trx.sendRawTransaction(signedTransaction);
      return result.txid;
    } catch (error) {
      console.error('Failed to send TRX:', error);
      throw error;
    }
  }

  async getTransaction(txHash: string): Promise<ChainTransaction> {
    if (!this.tronWeb || !TronWeb) {
      throw new Error('TronWeb not initialized');
    }

    try {
      const tx = await this.tronWeb.trx.getTransaction(txHash);
      const txInfo = await this.tronWeb.trx.getTransactionInfo(txHash);

      return {
        hash: tx.txID,
        from: this.tronWeb.address.fromHex(tx.raw_data?.contract?.[0]?.parameter?.value?.owner_address || ''),
        to: this.tronWeb.address.fromHex(tx.raw_data?.contract?.[0]?.parameter?.value?.to_address || ''),
        amount: ((tx.raw_data?.contract?.[0]?.parameter?.value?.amount || 0) / Math.pow(10, 6)).toString(),
        confirmations: txInfo.blockNumber ? 1 : 0,
        blockNumber: txInfo.blockNumber,
        timestamp: txInfo.blockTimeStamp ? Math.floor(txInfo.blockTimeStamp / 1000) : undefined,
      };
    } catch (error) {
      console.error('Failed to get Tron transaction:', error);
      throw error;
    }
  }

  monitorAddress(address: string, callback: (tx: ChainTransaction) => void): void {
    // TODO: Implement Tron address monitoring
    console.log(`Tron address monitoring for ${address} not yet implemented`);
  }

  async estimateGasFee(): Promise<string> {
    // TODO: Implement Tron gas fee estimation
    return '0.1'; // Placeholder
  }

  async getCurrentBlock(): Promise<number> {
    if (!this.tronWeb || !TronWeb) {
      throw new Error('TronWeb not initialized');
    }

    try {
      const block = await this.tronWeb.trx.getCurrentBlock();
      return block.block_header.raw_data.number;
    } catch (error) {
      console.error('Failed to get Tron current block:', error);
      return 0;
    }
  }

  // Tron-specific approve/sweep methods

  async fundSubWalletGas(masterWallet: ChainWallet, subWalletAddress: string): Promise<string> {
    if (!this.tronWeb || !TronWeb) {
      throw new Error('TronWeb not initialized');
    }

    // For Tron, we delegate energy instead of sending TRX
    // This is a simplified implementation - in production, use proper energy delegation
    try {
      this.tronWeb.setPrivateKey(masterWallet.privateKey);
      
      // Delegate energy from master to sub-wallet
      // Note: This requires the master wallet to have staked TRX for energy
      const transaction = await this.tronWeb.transactionBuilder.delegateResource(
        1000000, // Amount of energy to delegate (1M units)
        subWalletAddress,
        'ENERGY',
        masterWallet.address
      );
      
      const signedTransaction = await this.tronWeb.trx.sign(transaction);
      const result = await this.tronWeb.trx.sendRawTransaction(signedTransaction);
      
      return result.txid;
    } catch (error) {
      console.error('Failed to delegate energy on Tron:', error);
      throw error;
    }
  }

  async approveSubWallet(subWalletPrivateKey: string, masterWalletAddress: string): Promise<string> {
    if (!this.tronWeb || !TronWeb || !this.usdtContract) {
      throw new Error('TronWeb not initialized or USDT contract not configured');
    }

    try {
      this.tronWeb.setPrivateKey(subWalletPrivateKey);
      
      const contract = await this.tronWeb.contract().at(this.usdtContract);
      
      // Approve max amount for USDT
      const maxAmount = '115792089237316195423570985008687907853269984665640564039457584007913129639935'; // MaxUint256
      const result = await contract.approve(masterWalletAddress, maxAmount).send();
      
      return result;
    } catch (error) {
      console.error('Failed to approve on Tron:', error);
      throw error;
    }
  }

  async sweepSubWallet(
    masterWalletPrivateKey: string,
    subWalletAddress: string,
    masterWalletAddress: string,
    amount: string
  ): Promise<string> {
    if (!this.tronWeb || !TronWeb || !this.usdtContract) {
      throw new Error('TronWeb not initialized or USDT contract not configured');
    }

    try {
      this.tronWeb.setPrivateKey(masterWalletPrivateKey);
      
      const contract = await this.tronWeb.contract().at(this.usdtContract);
      
      // Convert amount to proper units (6 decimals for USDT on Tron)
      const amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, 6));
      
      const result = await contract.transferFrom(
        subWalletAddress,
        masterWalletAddress,
        amountInSmallestUnit
      ).send();
      
      return result;
    } catch (error) {
      console.error('Failed to sweep on Tron:', error);
      throw error;
    }
  }
}