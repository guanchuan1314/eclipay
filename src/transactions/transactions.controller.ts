import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { Transaction } from '../database/entities/transaction.entity';
import { JwtAuth } from '../auth/decorators/jwt-auth.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';

@ApiTags('transactions')
@Controller('projects/:projectId/transactions')
@JwtAuth()
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get transactions for project' })
  @ApiQuery({ name: 'chainId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of transactions' })
  async getTransactions(@Request() req, @Param('projectId') projectId: number, @Query('chainId') chainId?: number): Promise<Transaction[]> {
    return this.transactionsService.findProjectTransactions(req.user.id, projectId, chainId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiResponse({ status: 200, description: 'Transaction details' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransaction(@Request() req, @Param('projectId') projectId: number, @Param('id') id: number): Promise<Transaction> {
    return this.transactionsService.findTransaction(req.user.id, projectId, id);
  }

  @Get('hash/:txHash')
  @ApiOperation({ summary: 'Get transaction by hash' })
  @ApiResponse({ status: 200, description: 'Transaction details' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransactionByHash(@Request() req, @Param('projectId') projectId: number, @Param('txHash') txHash: string): Promise<Transaction> {
    return this.transactionsService.findTransactionByHash(req.user.id, projectId, txHash);
  }
}

// Legacy API key endpoints
@ApiTags('transactions')
@ApiSecurity('api-key')
@Controller('transactions')
export class LegacyTransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID (deprecated)' })
  @ApiResponse({ status: 200, description: 'Transaction details' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransaction(@Param('id') id: number, @Request() req): Promise<Transaction> {
    return this.transactionsService.findTransactionLegacy(id, req.project);
  }
}