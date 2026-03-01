import { Controller, Get, Param, Patch, Body, Query, Post, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ChainsService } from './chains.service';
import { Chain } from '../database/entities/chain.entity';
import { JwtAuth } from '../auth/decorators/jwt-auth.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('chains')
@Controller('chains')
export class ChainsController {
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  constructor(private readonly chainsService: ChainsService) {}

  @Get()
  @JwtAuth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all enabled chains' })
  @ApiQuery({ name: 'testnet', required: false, type: Boolean, description: 'Filter by testnet/mainnet chains' })
  @ApiResponse({ status: 200, description: 'List of enabled chains' })
  async findAll(@Query('testnet') testnet?: string): Promise<Chain[]> {
    const isTestnet = testnet === 'true' ? true : testnet === 'false' ? false : undefined;
    return this.chainsService.findAll(isTestnet);
  }

  @Get(':id')
  @JwtAuth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get chain by ID' })
  @ApiResponse({ status: 200, description: 'Chain details' })
  @ApiResponse({ status: 404, description: 'Chain not found' })
  async findOne(@Param('id') id: number): Promise<Chain> {
    return this.chainsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update chain configuration' })
  @ApiResponse({ status: 200, description: 'Chain updated successfully' })
  async update(
    @Param('id') id: number,
    @Body() updateData: Partial<Chain>
  ): Promise<Chain> {
    return this.chainsService.updateChain(id, updateData);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle chain enabled/disabled' })
  @ApiResponse({ status: 200, description: 'Chain toggled successfully' })
  async toggle(@Param('id') id: number): Promise<Chain> {
    return this.chainsService.toggleChain(id);
  }

  @Post('solana/airdrop')
  @Public()
  @ApiOperation({ summary: 'Request Solana devnet airdrop' })
  @ApiResponse({ status: 200, description: 'Airdrop successful' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async solanaAirdrop(@Body() dto: { address: string; amount: number }) {
    try {
      // Validate amount
      if (!dto.amount || dto.amount <= 0 || dto.amount > 2) {
        throw new HttpException(
          'Amount must be between 0.1 and 2 SOL',
          HttpStatus.BAD_REQUEST
        );
      }

      // Basic rate limiting (5 requests per minute)
      const clientKey = 'global'; // In a real app, you'd use IP or user ID
      const now = Date.now();
      const windowMs = 60 * 1000; // 1 minute
      
      const rateLimitEntry = this.rateLimitMap.get(clientKey);
      
      if (rateLimitEntry) {
        if (now < rateLimitEntry.resetTime) {
          if (rateLimitEntry.count >= 5) {
            throw new HttpException(
              'Rate limit exceeded. Try again later.',
              HttpStatus.TOO_MANY_REQUESTS
            );
          }
          rateLimitEntry.count++;
        } else {
          // Reset window
          this.rateLimitMap.set(clientKey, { count: 1, resetTime: now + windowMs });
        }
      } else {
        this.rateLimitMap.set(clientKey, { count: 1, resetTime: now + windowMs });
      }

      // Validate Solana address and perform airdrop
      const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      
      let publicKey: any;
      try {
        publicKey = new PublicKey(dto.address);
      } catch (error) {
        throw new HttpException(
          'Invalid Solana address format',
          HttpStatus.BAD_REQUEST
        );
      }

      const signature = await connection.requestAirdrop(
        publicKey,
        dto.amount * LAMPORTS_PER_SOL
      );

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      return {
        success: true,
        signature,
        amount: dto.amount,
        address: dto.address,
        explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Handle Solana-specific errors
      if (error.message?.includes('airdrop')) {
        throw new HttpException(
          'Airdrop failed. The devnet faucet might be rate limited. Please try again later.',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
      
      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}