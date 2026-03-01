import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Invoice } from '../database/entities/invoice.entity';
import { ChainsModule } from '../chains/chains.module';
import { WalletsModule } from '../wallets/wallets.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { InvoicesService } from './invoices.service';
import { PaymentMonitorService } from './payment-monitor.service';
import { InvoicesController, LegacyInvoicesController, PublicInvoicesController } from './invoices.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice]),
    BullModule.registerQueue({
      name: 'invoice-processing',
    }),
    ChainsModule,
    WalletsModule,
    AuthModule,
    ProjectsModule,
    WebhooksModule,
    TransactionsModule,
  ],
  controllers: [InvoicesController, LegacyInvoicesController, PublicInvoicesController],
  providers: [InvoicesService, PaymentMonitorService],
  exports: [InvoicesService],
})
export class InvoicesModule {}