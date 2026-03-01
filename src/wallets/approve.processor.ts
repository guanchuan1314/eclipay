import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bull';
import { SubWallet } from '../database/entities/sub-wallet.entity';
import { MasterWallet } from '../database/entities/master-wallet.entity';
import { ChainsService } from '../chains/chains.service';
import * as crypto from 'crypto';

@Injectable()
@Processor('approve-setup')
export class ApproveProcessor {
  private readonly logger = new Logger(ApproveProcessor.name);

  constructor(
    @InjectRepository(SubWallet)
    private readonly subWalletRepository: Repository<SubWallet>,
    @InjectRepository(MasterWallet)
    private readonly masterWalletRepository: Repository<MasterWallet>,
    private readonly chainsService: ChainsService,
  ) {}

  @Process('approve-sub-wallet')
  async handleApproveSubWallet(job: Job<{ subWalletId: number }>) {
    const { subWalletId } = job.data;
    this.logger.log(`Processing approve setup for sub-wallet ID: ${subWalletId}`);

    try {
      // Get sub-wallet and master wallet from DB
      const subWallet = await this.subWalletRepository.findOne({
        where: { id: subWalletId },
        relations: ['master_wallet', 'chain'],
      });

      if (!subWallet) {
        this.logger.error(`Sub-wallet with ID ${subWalletId} not found`);
        return;
      }

      const masterWallet = await this.masterWalletRepository.findOne({
        where: { id: subWallet.master_wallet_id },
      });

      if (!masterWallet) {
        this.logger.error(`Master wallet with ID ${subWallet.master_wallet_id} not found`);
        return;
      }

      // Get chain interface
      const chainInterface = await this.chainsService.getChainInterface(subWallet.chain_id);

      if (!chainInterface.fundSubWalletGas || !chainInterface.approveSubWallet) {
        this.logger.warn(`Chain ${subWallet.chain_id} does not support approve/sweep functionality`);
        return;
      }

      // Decrypt master wallet private key
      const masterPrivateKey = this.decryptPrivateKey(masterWallet.encrypted_private_key);
      
      // Create master wallet object for chain interface
      const masterWalletObj = {
        address: masterWallet.address,
        privateKey: masterPrivateKey,
      };

      // Step 1: Fund sub-wallet with gas
      this.logger.log(`Funding gas for sub-wallet ${subWallet.address}`);
      let gasTxHash: string;
      
      try {
        gasTxHash = await Promise.race([
          chainInterface.fundSubWalletGas(masterWalletObj, subWallet.address),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Gas funding timeout')), 5000)
          ),
        ]);
        this.logger.log(`Gas funding tx: ${gasTxHash}`);
      } catch (error) {
        this.logger.error(`Failed to fund gas for sub-wallet ${subWallet.address}:`, error);
        throw error;
      }

      // Step 2: Wait for gas transaction confirmation
      this.logger.log(`Waiting for gas tx confirmation: ${gasTxHash}`);
      await this.waitForTransactionConfirmation(chainInterface, gasTxHash, 5 * 60 * 1000); // 5 minutes max

      // Step 3: Approve master wallet for USDT transferFrom
      this.logger.log(`Approving master wallet for sub-wallet ${subWallet.address}`);
      
      if (!subWallet.encrypted_private_key) {
        this.logger.error(`Sub-wallet ${subWallet.id} has no encrypted private key stored`);
        throw new Error('Missing encrypted private key');
      }

      const subWalletPrivateKey = this.decryptPrivateKey(subWallet.encrypted_private_key);
      
      let approveTxHash: string;
      try {
        approveTxHash = await Promise.race([
          chainInterface.approveSubWallet(subWalletPrivateKey, masterWallet.address),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Approve timeout')), 5000)
          ),
        ]);
        this.logger.log(`Approve tx: ${approveTxHash}`);
      } catch (error) {
        this.logger.error(`Failed to approve sub-wallet ${subWallet.address}:`, error);
        throw error;
      }

      // Step 4: Wait for approve transaction confirmation
      this.logger.log(`Waiting for approve tx confirmation: ${approveTxHash}`);
      await this.waitForTransactionConfirmation(chainInterface, approveTxHash, 5 * 60 * 1000); // 5 minutes max

      // Step 5: Update sub-wallet as approved
      await this.subWalletRepository.update(subWalletId, { approved: true });
      this.logger.log(`Sub-wallet ${subWallet.address} successfully approved. Gas: ${gasTxHash}, Approve: ${approveTxHash}`);

    } catch (error) {
      this.logger.error(`Error in approve setup for sub-wallet ${subWalletId}:`, error);
      throw error; // This will trigger retry in Bull queue
    }
  }

  private async waitForTransactionConfirmation(
    chainInterface: any,
    txHash: string,
    maxWaitTime: number,
  ): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const tx = await Promise.race([
          chainInterface.getTransaction(txHash),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('getTransaction timeout')), 5000)
          ),
        ]);

        if (tx.confirmations >= 1) {
          this.logger.log(`Transaction ${txHash} confirmed with ${tx.confirmations} confirmations`);
          return;
        }

        this.logger.log(`Transaction ${txHash} has ${tx.confirmations} confirmations, waiting...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        this.logger.warn(`Error checking transaction ${txHash}:`, error);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(`Transaction ${txHash} confirmation timeout after ${maxWaitTime}ms`);
  }

  private decryptPrivateKey(encryptedPrivateKey: string): string {
    const key = process.env.ENCRYPTION_KEY || 'default-key-change-in-prod';
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedPrivateKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}