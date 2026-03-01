import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { TransactionsService } from './transactions.service';
import { ChainsService } from '../chains/chains.service';
import { TransactionStatus } from '../database/entities/transaction.entity';

@Injectable()
@Processor('transaction-processing')
export class TransactionMonitorService {
  constructor(
    @InjectQueue('transaction-processing')
    private readonly transactionQueue: Queue,
    private readonly transactionsService: TransactionsService,
    private readonly chainsService: ChainsService,
  ) {}

  @Process('monitor-confirmation')
  async handleTransactionConfirmation(job: Job) {
    const { transactionId, chainId, txHash } = job.data;
    
    try {
      const chainInterface = await this.chainsService.getChainInterface(chainId);
      const chainTx = await chainInterface.getTransaction(txHash);
      
      // Update transaction with confirmations
      await this.transactionsService.updateTransactionStatus(
        transactionId,
        chainTx.confirmations >= 3 ? TransactionStatus.CONFIRMED : TransactionStatus.PENDING,
        chainTx.confirmations,
        chainTx.blockNumber,
      );

      // If not confirmed yet, schedule another check
      if (chainTx.confirmations < 3) {
        await this.transactionQueue.add(
          'monitor-confirmation',
          { transactionId, chainId, txHash },
          { delay: 60000 }, // Check again in 1 minute
        );
      }
    } catch (error) {
      console.error(`Error monitoring transaction ${txHash}:`, error);
      
      // Mark as failed after too many failures
      if (job.attemptsMade >= 10) {
        await this.transactionsService.updateTransactionStatus(
          transactionId,
          TransactionStatus.FAILED,
        );
      } else {
        throw error; // Retry
      }
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkPendingTransactions() {
    console.log('Checking pending transactions...');
    
    try {
      const pendingTransactions = await this.transactionsService.findPendingTransactions();
      
      for (const tx of pendingTransactions) {
        // Add to queue for confirmation check
        await this.transactionQueue.add('monitor-confirmation', {
          transactionId: tx.id,
          chainId: tx.chain_id,
          txHash: tx.tx_hash,
        });
      }
      
      console.log(`Queued ${pendingTransactions.length} transactions for monitoring`);
    } catch (error) {
      console.error('Error in periodic transaction check:', error);
    }
  }

  async startAddressMonitoring(address: string, chainId: number, invoiceId?: number) {
    try {
      const chainInterface = await this.chainsService.getChainInterface(chainId);
      
      chainInterface.monitorAddress(address, async (tx) => {
        // Record the deposit transaction
        await this.transactionsService.recordDeposit(
          chainId,
          tx.hash,
          tx.from,
          tx.to,
          tx.amount,
          invoiceId,
        );
        
        console.log(`Detected deposit: ${tx.hash} to ${address}`);
      });
      
      console.log(`Started monitoring address ${address} on chain ${chainId}`);
    } catch (error) {
      console.error(`Error starting address monitoring for ${address}:`, error);
    }
  }
}