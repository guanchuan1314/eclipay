import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getAppInfo() {
    return {
      name: 'EcliPay',
      version: '1.0.0',
      description: 'Multi-chain USDT payment gateway',
      timestamp: new Date().toISOString(),
    };
  }
}