import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Transaction } from '../database/entities/transaction.entity';
import { ChainsModule } from '../chains/chains.module';
import { WalletsModule } from '../wallets/wallets.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { TransactionsService } from './transactions.service';
import { TransactionsController, LegacyTransactionsController } from './transactions.controller';
import { TransactionMonitorService } from './transaction-monitor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    BullModule.registerQueue({
      name: 'transaction-processing',
    }),
    ChainsModule,
    WalletsModule,
    AuthModule,
    ProjectsModule,
  ],
  controllers: [TransactionsController, LegacyTransactionsController],
  providers: [TransactionsService, TransactionMonitorService],
  exports: [TransactionsService],
})
export class TransactionsModule {}