import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chain } from '../database/entities/chain.entity';
import { ChainFactory } from './chain.factory';
import { ChainInterface } from './interfaces/chain.interface';

@Injectable()
export class ChainsService {
  constructor(
    @InjectRepository(Chain)
    private readonly chainRepository: Repository<Chain>,
    private readonly chainFactory: ChainFactory,
  ) {}

  async findAll(isTestnet?: boolean): Promise<Chain[]> {
    const whereCondition: any = { enabled: true };
    if (isTestnet !== undefined) {
      whereCondition.is_testnet = isTestnet;
    }
    
    return this.chainRepository.find({
      where: whereCondition,
      order: { name: 'ASC' },
    });
  }

  async getChains(isTestnet: boolean): Promise<Chain[]> {
    return this.chainRepository.find({
      where: { 
        enabled: true,
        is_testnet: isTestnet
      },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Chain> {
    const chain = await this.chainRepository.findOne({
      where: { id, enabled: true },
    });
    
    if (!chain) {
      throw new Error(`Chain with ID ${id} not found`);
    }
    
    return chain;
  }

  async findByName(name: string): Promise<Chain> {
    const chain = await this.chainRepository.findOne({
      where: { name, enabled: true },
    });
    
    if (!chain) {
      throw new Error(`Chain ${name} not found`);
    }
    
    return chain;
  }

  async getChainInterface(chainId: number): Promise<ChainInterface> {
    const chain = await this.findOne(chainId);
    return await this.chainFactory.createChain(chain);
  }

  async getChainInterfaceByName(name: string): Promise<ChainInterface> {
    const chain = await this.findByName(name);
    return await this.chainFactory.createChain(chain);
  }

  async updateChain(id: number, updateData: Partial<Chain>): Promise<Chain> {
    await this.chainRepository.update(id, updateData);
    return this.findOne(id);
  }

  async toggleChain(id: number): Promise<Chain> {
    const chain = await this.findOne(id);
    return this.updateChain(id, { enabled: !chain.enabled });
  }
}