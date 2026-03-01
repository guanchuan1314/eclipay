import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { MasterWallet } from '../database/entities/master-wallet.entity';
import { SubWallet } from '../database/entities/sub-wallet.entity';
import { Chain } from '../database/entities/chain.entity';
import { Project } from '../database/entities/project.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { ChainsModule } from '../chains/chains.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { WalletsService } from './wallets.service';
import { WalletsController, LegacyWalletsController } from './wallets.controller';
import { ApproveProcessor } from './approve.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([MasterWallet, SubWallet, Chain, Project, Transaction]),
    BullModule.registerQueue({
      name: 'approve-setup',
    }),
    ChainsModule,
    AuthModule,
    forwardRef(() => ProjectsModule),
  ],
  controllers: [WalletsController, LegacyWalletsController],
  providers: [WalletsService, ApproveProcessor],
  exports: [WalletsService],
})
export class WalletsModule {}