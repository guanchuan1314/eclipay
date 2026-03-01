import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { User } from '../database/entities/user.entity';
import { Project } from '../database/entities/project.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { JwtGuard } from './guards/jwt.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, Project])],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtGuard,
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
  exports: [AuthService, JwtGuard],
})
export class AuthModule {}