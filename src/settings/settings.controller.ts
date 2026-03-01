import { Controller, Get, Put, Body, Request, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuth } from '../auth/decorators/jwt-auth.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';

class UpdateWebhookDto {
  webhookUrl: string;
}

@ApiTags('settings')
@Controller('projects/:projectId/settings')
@JwtAuth()
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get settings for project' })
  @ApiResponse({ status: 200, description: 'Project settings' })
  async getSettings(@Request() req, @Param('projectId') projectId: number) {
    return this.settingsService.getSettings(req.user.id, projectId);
  }

  @Put()
  @ApiOperation({ summary: 'Update settings for project' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async updateSettings(@Request() req, @Param('projectId') projectId: number, @Body() dto: UpdateWebhookDto) {
    return this.settingsService.updateSettings(req.user.id, projectId, { webhookUrl: dto.webhookUrl });
  }
}