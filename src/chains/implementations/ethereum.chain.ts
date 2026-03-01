import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import { HDNodeWallet } from 'ethers';
import { ChainInterface, ChainWallet, ChainTransaction, ChainBalance } from '../interfaces/chain.interface';
import { Chain } from '../../database/entities/chain.entity';

@Injectable()
export class EthereumChain extends ChainInterface {
  name: string;
  standard = 'EVM';
  gasToken: string;
  usdtContract?: string;
  
  private provider: ethers.Provider;
  private chainConfig: Chain;

  configure(config: Chain) {
    this.chainConfig = config;
    this.name = config.name;
    this.gasToken = config.gas_token;
    this.usdtContract = config.usdt_contract;
    this.provider = new ethers.JsonRpcProvider(config.rpc_url);
  }

  async generateWallet(): Promise<ChainWallet> {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
    };
  }

  async deriveWallet(masterSeed: string, index: number): Promise<ChainWallet> {
    const seed = bip39.mnemonicToSeedSync(masterSeed);
    const hdNode = HDNodeWallet.fromSeed(seed);
    const derivedWallet = hdNode.derivePath(`m/44'/60'/0'/0/${index}`);
    
    return {
      address: derivedWallet.address,
      privateKey: derivedWallet.privateKey,
    };
  }

  validateAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  async getUSDTBalance(address: string): Promise<ChainBalance> {
    if (!this.usdtContract) {
      throw new Error('USDT contract not configured for this chain');
    }

    // USDT ABI
    const usdtAbi = [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
    ];

    const contract = new ethers.Contract(this.usdtContract, usdtAbi, this.provider);
    const balance = await contract.balanceOf(address);
    const decimals = 6; // USDT typically uses 6 decimals

    return {
      address,
      balance: ethers.formatUnits(balance, decimals),
      decimals,
    };
  }

  async getNativeBalance(address: string): Promise<ChainBalance> {
    const balance = await this.provider.getBalance(address);
    return {
      address,
      balance: ethers.formatEther(balance),
      decimals: 18,
    };
  }

  async sendUSDT(from: ChainWallet, to: string, amount: string): Promise<string> {
    if (!this.usdtContract) {
      throw new Error('USDT contract not configured for this chain');
    }

    const wallet = new ethers.Wallet(from.privateKey, this.provider);
    const contract = new ethers.Contract(
      this.usdtContract,
      ['function transfer(address to, uint256 amount) returns (bool)', 'function decimals() view returns (uint8)'],
      wallet
    );

    const decimals = await contract.decimals();
    const amountWei = ethers.parseUnits(amount, decimals);
    const tx = await contract.transfer(to, amountWei);
    
    return tx.hash;
  }

  async sendNative(from: ChainWallet, to: string, amount: string): Promise<string> {
    const wallet = new ethers.Wallet(from.privateKey, this.provider);
    const tx = await wallet.sendTransaction({
      to,
      value: ethers.parseEther(amount),
    });
    return tx.hash;
  }

  async getTransaction(txHash: string): Promise<ChainTransaction> {
    const [tx, receipt] = await Promise.all([
      this.provider.getTransaction(txHash),
      this.provider.getTransactionReceipt(txHash)
    ]);

    if (!tx) {
      throw new Error('Transaction not found');
    }

    const currentBlock = await this.provider.getBlockNumber();
    const confirmations = receipt ? currentBlock - receipt.blockNumber : 0;

    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to || '',
      amount: ethers.formatEther(tx.value),
      confirmations,
      blockNumber: receipt?.blockNumber,
      timestamp: tx.blockNumber ? (await this.provider.getBlock(tx.blockNumber))?.timestamp : undefined,
    };
  }

  monitorAddress(address: string, callback: (tx: ChainTransaction) => void): void {
    // Basic implementation - in production, use WebSockets or event listeners
    const filter = {
      address: this.usdtContract,
      topics: [
        ethers.id('Transfer(address,address,uint256)'),
        null, // from (any address)
        ethers.zeroPadValue(address, 32), // to (our address)
      ],
    };

    this.provider.on(filter, async (log) => {
      try {
        const tx = await this.getTransaction(log.transactionHash);
        callback(tx);
      } catch (error) {
        console.error('Error processing transfer event:', error);
      }
    });
  }

  async estimateGasFee(): Promise<string> {
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    const estimatedGas = 21000n; // Basic transfer
    
    return ethers.formatEther(gasPrice * estimatedGas);
  }

  async getCurrentBlock(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  // New methods for approve/sweep functionality

  async fundSubWalletGas(masterWallet: ChainWallet, subWalletAddress: string, amount: string): Promise<string> {
    const wallet = new ethers.Wallet(masterWallet.privateKey, this.provider);
    
    // Amount should be enough for 1 approve tx (~50k gas * current gas price * 1.5 buffer)
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    const estimatedAmount = gasPrice * BigInt(50000) * BigInt(150) / BigInt(100); // 1.5x buffer
    
    const actualAmount = amount ? ethers.parseEther(amount) : estimatedAmount;
    
    const tx = await wallet.sendTransaction({
      to: subWalletAddress,
      value: actualAmount,
    });
    
    return tx.hash;
  }

  async approveSubWallet(subWalletPrivateKey: string, masterWalletAddress: string): Promise<string> {
    if (!this.usdtContract) {
      throw new Error('USDT contract not configured for this chain');
    }

    const wallet = new ethers.Wallet(subWalletPrivateKey, this.provider);
    
    // USDT ABI for approve
    const usdtAbi = [
      'function approve(address spender, uint256 amount) returns (bool)',
    ];
    
    const contract = new ethers.Contract(this.usdtContract, usdtAbi, wallet);
    
    // Approve max amount (MaxUint256)
    const tx = await contract.approve(masterWalletAddress, ethers.MaxUint256);
    
    return tx.hash;
  }

  async sweepSubWallet(
    masterWalletPrivateKey: string, 
    subWalletAddress: string, 
    masterWalletAddress: string, 
    amount: string
  ): Promise<string> {
    if (!this.usdtContract) {
      throw new Error('USDT contract not configured for this chain');
    }

    const wallet = new ethers.Wallet(masterWalletPrivateKey, this.provider);
    
    // USDT ABI for transferFrom
    const usdtAbi = [
      'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    ];
    
    const contract = new ethers.Contract(this.usdtContract, usdtAbi, wallet);
    
    // Convert amount to proper units (6 decimals for USDT)
    const amountWei = ethers.parseUnits(amount, 6);
    
    const tx = await contract.transferFrom(subWalletAddress, masterWalletAddress, amountWei);
    
    return tx.hash;
  }
}