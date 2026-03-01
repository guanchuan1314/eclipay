import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SweepService } from './sweep.service';
import { SubWallet } from '../database/entities/sub-wallet.entity';
import { MasterWallet } from '../database/entities/master-wallet.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { ChainsModule } from '../chains/chains.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubWallet, MasterWallet, Transaction]),
    ChainsModule,
    ScheduleModule.forRoot(),
  ],
  providers: [SweepService],
  exports: [SweepService],
})
export class SweepModule {}