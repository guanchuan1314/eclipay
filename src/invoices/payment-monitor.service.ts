import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Invoice, InvoiceStatus } from '../database/entities/invoice.entity';
import { InvoicesService } from './invoices.service';
import { TransactionsService } from '../transactions/transactions.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ChainsService } from '../chains/chains.service';

@Injectable()
export class PaymentMonitorService {
  private readonly logger = new Logger(PaymentMonitorService.name);
  private isRunning = false;

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly invoicesService: InvoicesService,
    private readonly transactionsService: TransactionsService,
    private readonly webhooksService: WebhooksService,
    private readonly chainsService: ChainsService,
  ) {}

  @Cron('*/5 * * * * *') // Every 5 seconds
  async monitorPayments(): Promise<void> {
    if (this.isRunning) return; // Skip if previous sweep still active
    this.isRunning = true;

    try {
      // Find all pending invoices that haven't expired
      const pendingInvoices = await this.invoiceRepository.find({
        where: {
          status: InvoiceStatus.PENDING,
          expired_at: MoreThan(new Date()),
        },
        relations: ['sub_wallet', 'chain', 'project'],
        order: { created_at: 'ASC' },
      });

      this.logger.debug(`Monitoring ${pendingInvoices.length} pending invoices`);

      // Group invoices by chain
      const byChain = new Map<number, Invoice[]>();
      for (const inv of pendingInvoices) {
        const arr = byChain.get(inv.chain_id) || [];
        arr.push(inv);
        byChain.set(inv.chain_id, arr);
      }

      // Process all chains in parallel
      await Promise.all(
        Array.from(byChain.entries()).map(([chainId, invoices]) => 
          this.checkChainInvoices(chainId, invoices)
        )
      );

      // Check for expired invoices
      await this.checkExpiredInvoices();

    } catch (error) {
      this.logger.error('Error in payment monitoring:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async checkChainInvoices(chainId: number, invoices: Invoice[]): Promise<void> {
    try {
      const chainInterface = await this.chainsService.getChainInterface(chainId);
      
      if (!chainInterface.getUSDTBalance) {
        this.logger.warn(`Chain ${chainId} does not support USDT balance checking`);
        return;
      }

      // Process in batches of 10
      for (let i = 0; i < invoices.length; i += 10) {
        const batch = invoices.slice(i, i + 10);
        await Promise.allSettled(
          batch.map(inv => this.checkInvoicePayment(inv, chainInterface))
        );
      }
    } catch (error) {
      // Skip entire chain if interface fails
      console.error(`Chain ${chainId} RPC unavailable, skipping ${invoices.length} invoices`);
    }
  }

  private async checkInvoicePayment(invoice: Invoice, chainInterface?: any): Promise<void> {
    try {
      // Get chain interface for the invoice's chain
      const chain = chainInterface || await this.chainsService.getChainInterface(invoice.chain_id);
      
      if (!chain.getUSDTBalance) {
        this.logger.warn(`Chain ${invoice.chain_id} does not support USDT balance checking`);
        return;
      }

      // Check USDT balance on sub-wallet address with timeout
      const balanceResult = await Promise.race([
        chain.getUSDTBalance(invoice.sub_wallet.address),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Balance check timeout')), 5000)
        ),
      ]);

      const balance = parseFloat(balanceResult.balance);
      const requiredAmount = parseFloat(invoice.amount);

      this.logger.debug(`Invoice ${invoice.id}: Balance ${balance}, Required ${requiredAmount}`);

      // If balance >= required amount, mark as paid
      if (balance >= requiredAmount) {
        this.logger.log(`Payment detected for invoice ${invoice.id}: ${balance} USDT received`);
        
        // Mark invoice as paid
        await this.invoicesService.markInvoiceAsPaid(invoice.id);

        // Record the deposit transaction
        await this.transactionsService.recordDeposit(
          invoice.chain_id,
          'pending_detection', // We don't have the exact tx hash from balance check
          'unknown_sender', // We don't know the sender from balance check
          invoice.sub_wallet.address,
          balance.toString(),
          invoice.id,
          invoice.project_id,
        );

        // Send webhook if callback URL exists
        if (invoice.callback_url) {
          try {
            await this.webhooksService.sendInvoicePaidWebhook(
              invoice.callback_url,
              invoice.id,
              invoice.project_id,
              invoice.external_id,
              invoice.amount,
              invoice.chain_id,
              'pending_detection', // Placeholder tx hash
              undefined, // Project doesn't have webhook_secret, could be added later
            );
            this.logger.log(`Webhook sent for paid invoice ${invoice.id}`);
          } catch (webhookError) {
            this.logger.error(`Failed to send webhook for invoice ${invoice.id}:`, webhookError);
          }
        }
      }

    } catch (error) {
      // Skip this chain if RPC is down, don't crash the whole job
      if (error.message.includes('timeout') || error.message.includes('network')) {
        this.logger.warn(`Skipping invoice ${invoice.id} due to chain ${invoice.chain_id} RPC issues: ${error.message}`);
      } else {
        this.logger.error(`Error checking payment for invoice ${invoice.id}:`, error);
      }
    }
  }

  private async checkExpiredInvoices(): Promise<void> {
    try {
      // Find invoices that are expired but still pending
      const expiredInvoices = await this.invoiceRepository.find({
        where: {
          status: InvoiceStatus.PENDING,
          expired_at: MoreThan(new Date(Date.now() - 24 * 60 * 60 * 1000)), // Within last 24 hours
        },
        relations: ['project'],
      });

      const nowExpiredInvoices = expiredInvoices.filter(invoice => 
        invoice.expired_at && invoice.expired_at < new Date()
      );

      if (nowExpiredInvoices.length > 0) {
        this.logger.log(`Found ${nowExpiredInvoices.length} newly expired invoices`);
      } else {
        this.logger.debug(`No newly expired invoices found`);
      }

      for (const invoice of nowExpiredInvoices) {
        try {
          // Mark invoice as expired
          await this.invoicesService.markInvoiceAsExpired(invoice.id);
          this.logger.log(`Marked invoice ${invoice.id} as expired`);

          // Send expired webhook if callback URL exists
          if (invoice.callback_url) {
            try {
              await this.webhooksService.sendInvoiceExpiredWebhook(
                invoice.callback_url,
                invoice.id,
                invoice.project_id,
                invoice.external_id,
                invoice.amount,
                invoice.chain_id,
                undefined, // Project doesn't have webhook_secret, could be added later
              );
              this.logger.log(`Expired webhook sent for invoice ${invoice.id}`);
            } catch (webhookError) {
              this.logger.error(`Failed to send expired webhook for invoice ${invoice.id}:`, webhookError);
            }
          }

        } catch (error) {
          this.logger.error(`Error marking invoice ${invoice.id} as expired:`, error);
        }
      }

    } catch (error) {
      this.logger.error('Error checking expired invoices:', error);
    }
  }
}