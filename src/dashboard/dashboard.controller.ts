import { Controller, Get, Query, Request, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuth } from '../auth/decorators/jwt-auth.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';

@ApiTags('dashboard')
@Controller('projects/:projectId')
@JwtAuth()
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics for project' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics' })
  async getStats(@Request() req, @Param('projectId') projectId: number) {
    return this.dashboardService.getStats(req.user.id, projectId);
  }

  @Get('recent-transactions')
  @ApiOperation({ summary: 'Get recent transactions for project' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Recent transactions' })
  async getRecentTransactions(
    @Request() req, 
    @Param('projectId') projectId: number, 
    @Query('limit') limit: number = 10
  ) {
    return this.dashboardService.getRecentTransactions(req.user.id, projectId, limit);
  }
}