import { Injectable } from '@nestjs/common';
import { ChainInterface } from './interfaces/chain.interface';
import { Chain } from '../database/entities/chain.entity';
import { EthereumChain } from './implementations/ethereum.chain';
import { TronChain } from './implementations/tron.chain';
import { SolanaChain } from './implementations/solana.chain';
import { TonChain } from './implementations/ton.chain';

@Injectable()
export class ChainFactory {
  constructor(
    private readonly ethereumChain: EthereumChain,
    private readonly tronChain: TronChain,
    private readonly solanaChain: SolanaChain,
    private readonly tonChain: TonChain,
  ) {}

  async createChain(chainConfig: Chain): Promise<ChainInterface> {
    switch (chainConfig.standard.toUpperCase()) {
      case 'EVM':
        return this.createEVMChain(chainConfig);
      case 'TRON':
        return await this.createTronChain(chainConfig);
      case 'SOLANA':
        return this.createSolanaChain(chainConfig);
      case 'TON':
        return await this.createTonChain(chainConfig);
      default:
        throw new Error(`Unsupported chain standard: ${chainConfig.standard}`);
    }
  }

  private createEVMChain(config: Chain): EthereumChain {
    // Configure the ethereum chain with specific config
    this.ethereumChain.configure(config);
    return this.ethereumChain;
  }

  private async createTronChain(config: Chain): Promise<TronChain> {
    await this.tronChain.configure(config);
    return this.tronChain;
  }

  private createSolanaChain(config: Chain): SolanaChain {
    this.solanaChain.configure(config);
    return this.solanaChain;
  }

  private async createTonChain(config: Chain): Promise<TonChain> {
    await this.tonChain.configure(config);
    return this.tonChain;
  }
}