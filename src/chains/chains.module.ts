import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chain } from '../database/entities/chain.entity';
import { ChainsService } from './chains.service';
import { ChainsController } from './chains.controller';
import { ChainFactory } from './chain.factory';

// Chain implementations
import { EthereumChain } from './implementations/ethereum.chain';
import { TronChain } from './implementations/tron.chain';
import { SolanaChain } from './implementations/solana.chain';
import { TonChain } from './implementations/ton.chain';

@Module({
  imports: [TypeOrmModule.forFeature([Chain])],
  controllers: [ChainsController],
  providers: [
    ChainsService,
    ChainFactory,
    EthereumChain,
    TronChain,
    SolanaChain,
    TonChain,
  ],
  exports: [ChainsService, ChainFactory],
})
export class ChainsModule {}