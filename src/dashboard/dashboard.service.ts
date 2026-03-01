import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionStatus } from '../database/entities/transaction.entity';
import { SubWallet } from '../database/entities/sub-wallet.entity';
import { Invoice } from '../database/entities/invoice.entity';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(SubWallet)
    private readonly subWalletRepository: Repository<SubWallet>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly projectsService: ProjectsService,
  ) {}

  async getStats(userId: number, projectId: number) {
    // Validate project ownership
    await this.projectsService.validateOwnership(userId, projectId);

    // Get total deposits
    const totalDepositsResult = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.project_id = :projectId', { projectId })
      .andWhere('transaction.type = :type', { type: 'deposit' })
      .andWhere('transaction.status = :status', { status: TransactionStatus.CONFIRMED })
      .andWhere('transaction.token = :token', { token: 'USDT' })
      .select('SUM(CAST(transaction.amount AS DECIMAL))', 'total')
      .getRawOne();

    // Get total transactions count
    const totalTransactionsResult = await this.transactionRepository.count({
      where: { project_id: projectId },
    });

    // Get active wallets count
    const activeWallets = await this.subWalletRepository.count({
      where: { project_id: projectId, approved: true },
    });

    // Get balance by chain (simplified - this would need to query actual balances)
    const balanceByChain = await this.subWalletRepository
      .createQueryBuilder('sub_wallet')
      .leftJoin('sub_wallet.chain', 'chain')
      .where('sub_wallet.project_id = :projectId', { projectId })
      .select(['chain.name as chainName', 'chain.id as chainId', 'COUNT(sub_wallet.id) as walletCount'])
      .groupBy('chain.id, chain.name')
      .getRawMany();

    return {
      totalDeposits: totalDepositsResult?.total || '0',
      totalTransactions: totalTransactionsResult || 0,
      activeWallets,
      balanceByChain: balanceByChain.map(item => ({
        chainId: item.chainId,
        chainName: item.chainName,
        balance: '0', // This would need actual balance querying
        walletCount: parseInt(item.walletCount),
      })),
    };
  }

  async getRecentTransactions(userId: number, projectId: number, limit: number = 10) {
    // Validate project ownership
    await this.projectsService.validateOwnership(userId, projectId);

    return this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.chain', 'chain')
      .where('transaction.project_id = :projectId', { projectId })
      .select([
        'transaction.id',
        'transaction.tx_hash',
        'transaction.from_address',
        'transaction.to_address',
        'transaction.amount',
        'transaction.type',
        'transaction.status',
        'transaction.created_at',
        'chain.name',
        'chain.gas_token',
      ])
      .orderBy('transaction.created_at', 'DESC')
      .limit(limit)
      .getMany();
  }
}