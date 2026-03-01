import { Injectable } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import axios from 'axios';

@Injectable()
@Processor('webhook-delivery')
export class WebhookProcessor {
  @Process('deliver-webhook')
  async handleWebhookDelivery(job: Job) {
    const { url, payload, signature, retryCount } = job.data;
    
    try {
      const headers: any = {
        'Content-Type': 'application/json',
        'User-Agent': 'EcliPay-Webhook/1.0',
        'X-EcliPay-Delivery': job.id,
        'X-EcliPay-Event': payload.event,
        'X-EcliPay-Timestamp': payload.timestamp,
      };

      // Add signature header if available
      if (signature) {
        headers['X-EcliPay-Signature'] = `sha256=${signature}`;
      }

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000, // 10 seconds timeout
        validateStatus: (status) => status >= 200 && status < 300,
      });

      console.log(`Webhook delivered successfully: ${url}`, {
        status: response.status,
        invoiceId: payload.invoiceId,
        event: payload.event,
      });

      return { success: true, status: response.status };
    } catch (error) {
      console.error(`Webhook delivery failed: ${url}`, {
        error: error.message,
        status: error.response?.status,
        invoiceId: payload.invoiceId,
        event: payload.event,
        attempt: job.attemptsMade,
        maxAttempts: retryCount,
      });

      // If this is the final attempt, log the permanent failure
      if (job.attemptsMade >= retryCount) {
        console.error(`Webhook permanently failed after ${retryCount} attempts: ${url}`, {
          invoiceId: payload.invoiceId,
          event: payload.event,
        });
      }

      throw error; // Re-throw to trigger retry
    }
  }
}