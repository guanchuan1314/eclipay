import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as crypto from 'crypto';

export interface WebhookPayload {
  event: string;
  invoiceId: number;
  merchantId: number;
  externalId?: string;
  amount: string;
  chainId: number;
  status: string;
  timestamp: string;
  transactionHash?: string;
}

@Injectable()
export class WebhooksService {
  constructor(
    @InjectQueue('webhook-delivery')
    private readonly webhookQueue: Queue,
  ) {}

  async sendWebhook(
    webhookUrl: string,
    payload: WebhookPayload,
    secret?: string,
    retryCount: number = 3,
  ): Promise<void> {
    // Generate signature for webhook verification
    const signature = this.generateSignature(payload, secret);
    
    await this.webhookQueue.add(
      'deliver-webhook',
      {
        url: webhookUrl,
        payload,
        signature,
        retryCount,
      },
      {
        attempts: retryCount,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }

  async sendInvoicePaidWebhook(
    webhookUrl: string,
    invoiceId: number,
    merchantId: number,
    externalId: string | undefined,
    amount: string,
    chainId: number,
    transactionHash: string,
    secret?: string,
  ): Promise<void> {
    const payload: WebhookPayload = {
      event: 'invoice.paid',
      invoiceId,
      merchantId,
      externalId,
      amount,
      chainId,
      status: 'paid',
      timestamp: new Date().toISOString(),
      transactionHash,
    };

    await this.sendWebhook(webhookUrl, payload, secret);
  }

  async sendInvoiceExpiredWebhook(
    webhookUrl: string,
    invoiceId: number,
    merchantId: number,
    externalId: string | undefined,
    amount: string,
    chainId: number,
    secret?: string,
  ): Promise<void> {
    const payload: WebhookPayload = {
      event: 'invoice.expired',
      invoiceId,
      merchantId,
      externalId,
      amount,
      chainId,
      status: 'expired',
      timestamp: new Date().toISOString(),
    };

    await this.sendWebhook(webhookUrl, payload, secret);
  }

  private generateSignature(payload: any, secret?: string): string {
    if (!secret) {
      return '';
    }
    
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  verifyWebhookSignature(payload: any, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  }
}