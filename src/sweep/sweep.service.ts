import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubWallet } from '../database/entities/sub-wallet.entity';
import { MasterWallet } from '../database/entities/master-wallet.entity';
import { Transaction, TransactionType, TransactionStatus } from '../database/entities/transaction.entity';
import { ChainsService } from '../chains/chains.service';

@Injectable()
export class SweepService {
  private readonly logger = new Logger(SweepService.name);

  constructor(
    @InjectRepository(SubWallet)
    private readonly subWalletRepository: Repository<SubWallet>,
    @InjectRepository(MasterWallet)
    private readonly masterWalletRepository: Repository<MasterWallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly chainsService: ChainsService,
  ) {}

  @Cron('*/5 * * * *') // Run every 5 minutes
  async performSweep(): Promise<void> {
    this.logger.log('Starting sweep job...');

    try {
      // Find all payment sub-wallets that are approved
      const subWallets = await this.subWalletRepository.find({
        where: { approved: true, type: 'payment' },
        relations: ['chain', 'master_wallet', 'project'],
      });

      for (const subWallet of subWallets) {
        try {
          await this.sweepSubWallet(subWallet);
        } catch (error) {
          this.logger.error(`Failed to sweep sub-wallet ${subWallet.address}:`, error);
        }
      }

      this.logger.log('Sweep job completed');
    } catch (error) {
      this.logger.error('Sweep job failed:', error);
    }
  }

  private async sweepSubWallet(subWallet: SubWallet): Promise<void> {
    const chainInterface = await this.chainsService.getChainInterface(subWallet.chain_id);

    // Check USDT balance
    const usdtBalance = await chainInterface.getUSDTBalance(subWallet.address);
    const balance = parseFloat(usdtBalance.balance);

    if (balance <= 0) {
      return; // No balance to sweep
    }

    this.logger.log(`Sweeping ${balance} USDT from ${subWallet.address} on chain ${subWallet.chain_id}`);

    // Get master wallet
    const masterWallet = await this.masterWalletRepository.findOne({
      where: { id: subWallet.master_wallet_id },
    });

    if (!masterWallet) {
      throw new Error(`Master wallet not found for sub-wallet ${subWallet.id}`);
    }

    // Decrypt master wallet private key (implement proper decryption)
    const masterPrivateKey = this.decryptPrivateKey(masterWallet.encrypted_private_key);

    // Perform sweep if the chain supports it
    if (chainInterface.sweepSubWallet) {
      try {
        const txHash = await chainInterface.sweepSubWallet(
          masterPrivateKey,
          subWallet.address,
          masterWallet.address,
          balance.toString()
        );

        // Log sweep transaction
        await this.logSweepTransaction(
          subWallet,
          masterWallet,
          balance.toString(),
          txHash
        );

        this.logger.log(`Successfully swept ${balance} USDT from ${subWallet.address}, tx: ${txHash}`);
      } catch (error) {
        this.logger.error(`Failed to sweep from ${subWallet.address}:`, error);
      }
    }
  }

  private async logSweepTransaction(
    subWallet: SubWallet,
    masterWallet: MasterWallet,
    amount: string,
    txHash: string
  ): Promise<void> {
    const transaction = this.transactionRepository.create({
      chain_id: subWallet.chain_id,
      tx_hash: txHash,
      from_address: subWallet.address,
      to_address: masterWallet.address,
      amount: amount,
      type: TransactionType.WITHDRAWAL, // Use enum value
      status: TransactionStatus.PENDING, // Use enum value
      project_id: subWallet.project_id,
    });

    await this.transactionRepository.save(transaction);
  }

  private decryptPrivateKey(encryptedPrivateKey: string): string {
    // Simple decryption for demo - in production, use proper encryption with HSM
    const crypto = require('crypto');
    const key = process.env.ENCRYPTION_KEY || 'default-key-change-in-prod';
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedPrivateKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}