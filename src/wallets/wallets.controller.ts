import { Controller, Get, Post, Param, Body, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiBearerAuth } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { SubWallet } from '../database/entities/sub-wallet.entity';
import { JwtAuth } from '../auth/decorators/jwt-auth.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';

class GenerateSubWalletDto {
  chainId: number;
  projectId: number;
  masterSeed?: string;
}

class CreateWalletDto {
  chainId: number;
}

@ApiTags('wallets')
@Controller('projects/:projectId/wallets')
@JwtAuth()
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @ApiOperation({ summary: 'Get wallets for project' })
  @ApiResponse({ status: 200, description: 'List of wallets' })
  async getWallets(@Request() req, @Param('projectId') projectId: number): Promise<SubWallet[]> {
    return this.walletsService.findSubWalletsByProject(req.user.id, projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Create payment wallet for project' })
  @ApiResponse({ status: 201, description: 'Payment wallet created successfully' })
  async createWallet(@Request() req, @Param('projectId') projectId: number, @Body() dto: CreateWalletDto): Promise<SubWallet> {
    return this.walletsService.generateSubWallet(req.user.id, projectId, dto.chainId);
  }

  @Post('client')
  @ApiOperation({ summary: 'Create client wallet for project' })
  @ApiResponse({ status: 201, description: 'Client wallet created successfully' })
  async createClientWallet(@Request() req, @Param('projectId') projectId: number, @Body() dto: CreateWalletDto): Promise<SubWallet> {
    return this.walletsService.generateClientSubWallet(req.user.id, projectId, dto.chainId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sub-wallet by ID' })
  @ApiResponse({ status: 200, description: 'Sub-wallet details' })
  @ApiResponse({ status: 404, description: 'Sub-wallet not found' })
  async getSubWallet(@Request() req, @Param('projectId') projectId: number, @Param('id') id: number): Promise<SubWallet> {
    return this.walletsService.findSubWallet(req.user.id, projectId, id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a sub-wallet for use' })
  @ApiResponse({ status: 200, description: 'Sub-wallet approved successfully' })
  async approveSubWallet(@Request() req, @Param('projectId') projectId: number, @Param('id') id: number): Promise<SubWallet> {
    return this.walletsService.approveSubWallet(req.user.id, projectId, id);
  }

  @Get(':id/assets')
  @ApiOperation({ summary: 'Get wallet assets (native + USDT)' })
  @ApiResponse({ status: 200, description: 'Wallet assets retrieved successfully' })
  async getWalletAssets(@Request() req, @Param('projectId') projectId: number, @Param('id') id: number) {
    return this.walletsService.getWalletAssets(req.user.id, projectId, id);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Send token from wallet' })
  @ApiResponse({ status: 200, description: 'Token sent successfully' })
  async sendFromWallet(@Request() req, @Param('projectId') projectId: number, @Param('id') id: number, @Body() dto: { to: string; amount: string; tokenType: 'native' | 'usdt' }) {
    return this.walletsService.sendFromWallet(req.user.id, projectId, id, dto);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Get transactions for a wallet' })
  @ApiResponse({ status: 200, description: 'Wallet transactions' })
  async getWalletTransactions(@Request() req, @Param('projectId') projectId: number, @Param('id') id: number) {
    return this.walletsService.getWalletTransactions(req.user.id, projectId, id);
  }
}

// Legacy API key endpoints
@ApiTags('wallets')
@ApiSecurity('api-key')
@Controller('wallets')
export class LegacyWalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post('sub-wallets')
  @ApiOperation({ summary: 'Generate a new sub-wallet (deprecated)' })
  @ApiResponse({ status: 201, description: 'Sub-wallet created successfully' })
  async generateSubWallet(@Body() dto: GenerateSubWalletDto, @Request() req): Promise<SubWallet> {
    return this.walletsService.generateSubWalletLegacy(
      dto.chainId,
      dto.projectId,
      dto.masterSeed,
      req.project,
    );
  }
}