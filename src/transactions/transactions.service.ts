import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Transaction, TransactionType, TransactionStatus } from '../database/entities/transaction.entity';
import { Project } from '../database/entities/project.entity';
import { ChainsService } from '../chains/chains.service';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectQueue('transaction-processing')
    private readonly transactionQueue: Queue,
    private readonly chainsService: ChainsService,
    private readonly projectsService: ProjectsService,
  ) {}

  async findProjectTransactions(userId: number, projectId: number, chainId?: number): Promise<Transaction[]> {
    // Validate project ownership
    await this.projectsService.validateOwnership(userId, projectId);

    const where: any = { project_id: projectId };
    if (chainId) where.chain_id = chainId;

    return this.transactionRepository.find({
      where,
      relations: ['chain'],
      order: { created_at: 'DESC' },
    });
  }

  async findTransaction(userId: number, projectId: number, id: number): Promise<Transaction> {
    // Validate project ownership
    await this.projectsService.validateOwnership(userId, projectId);

    const transaction = await this.transactionRepository.findOne({
      where: { id, project_id: projectId },
      relations: ['chain'],
    });
    
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }
    
    return transaction;
  }

  async findTransactionByHash(userId: number, projectId: number, txHash: string): Promise<Transaction> {
    // Validate project ownership
    await this.projectsService.validateOwnership(userId, projectId);

    const transaction = await this.transactionRepository.findOne({
      where: { tx_hash: txHash, project_id: projectId },
      relations: ['chain'],
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with hash ${txHash} not found`);
    }

    return transaction;
  }

  // Legacy methods for API key access
  async findTransactionLegacy(id: number, project: Project): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id, project_id: project.id },
      relations: ['chain'],
    });
    
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }
    
    return transaction;
  }

  // System methods for internal use
  async recordDeposit(
    chainId: number,
    txHash: string,
    fromAddress: string,
    toAddress: string,
    amount: string,
    invoiceId?: number,
    projectId?: number,
  ): Promise<Transaction> {
    const transaction = this.transactionRepository.create({
      chain_id: chainId,
      tx_hash: txHash,
      from_address: fromAddress,
      to_address: toAddress,
      amount,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
      invoice_id: invoiceId,
      project_id: projectId,
    });

    const saved = await this.transactionRepository.save(transaction);
    
    // Queue for confirmation monitoring
    await this.transactionQueue.add('monitor-confirmation', {
      transactionId: saved.id,
      chainId,
      txHash,
    });

    return saved;
  }

  async recordWithdrawal(
    chainId: number,
    txHash: string,
    fromAddress: string,
    toAddress: string,
    amount: string,
    projectId?: number,
  ): Promise<Transaction> {
    const transaction = this.transactionRepository.create({
      chain_id: chainId,
      tx_hash: txHash,
      from_address: fromAddress,
      to_address: toAddress,
      amount,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
      project_id: projectId,
    });

    const saved = await this.transactionRepository.save(transaction);
    
    // Queue for confirmation monitoring
    await this.transactionQueue.add('monitor-confirmation', {
      transactionId: saved.id,
      chainId,
      txHash,
    });

    return saved;
  }

  async updateTransactionStatus(
    id: number,
    status: TransactionStatus,
    confirmations?: number,
    blockNumber?: number,
  ): Promise<Transaction> {
    const updateData: any = { status };
    if (confirmations !== undefined) updateData.confirmations = confirmations;
    if (blockNumber !== undefined) updateData.block_number = blockNumber;

    await this.transactionRepository.update(id, updateData);
    return this.transactionRepository.findOne({
      where: { id },
      relations: ['chain'],
    });
  }

  async findTransactionByHashSystem(txHash: string): Promise<Transaction | null> {
    return this.transactionRepository.findOne({
      where: { tx_hash: txHash },
      relations: ['chain'],
    });
  }

  async findTransactionsByAddress(address: string): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: [
        { from_address: address },
        { to_address: address },
      ],
      relations: ['chain'],
      order: { created_at: 'DESC' },
    });
  }

  async findPendingTransactions(chainId?: number): Promise<Transaction[]> {
    const where: any = { status: TransactionStatus.PENDING };
    if (chainId) where.chain_id = chainId;

    return this.transactionRepository.find({
      where,
      relations: ['chain'],
      order: { created_at: 'ASC' },
    });
  }

  async getTransactionStats() {
    const [totalTransactions, pendingCount, confirmedCount, failedCount] = await Promise.all([
      this.transactionRepository.count(),
      this.transactionRepository.count({ where: { status: TransactionStatus.PENDING } }),
      this.transactionRepository.count({ where: { status: TransactionStatus.CONFIRMED } }),
      this.transactionRepository.count({ where: { status: TransactionStatus.FAILED } }),
    ]);

    return {
      total: totalTransactions,
      pending: pendingCount,
      confirmed: confirmedCount,
      failed: failedCount,
    };
  }
}