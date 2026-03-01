import { Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProjectsService } from './projects.service';
import { WalletsService } from '../wallets/wallets.service';
import { JwtAuth } from '../auth/decorators/jwt-auth.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';

class CreateProjectDto {
  name: string;
  webhookUrl?: string;
  environment?: 'testnet' | 'mainnet';
}

class UpdateProjectDto {
  name?: string;
  webhookUrl?: string;
  logoUrl?: string;
  businessName?: string;
  businessAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
}

class UpdateSettingsDto {
  webhookUrl?: string;
  logoUrl?: string;
  businessName?: string;
  businessAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
}

@ApiTags('projects')
@Controller('projects')
@JwtAuth()
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly walletsService: WalletsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  @ApiBody({ type: CreateProjectDto })
  async create(@Request() req, @Body() dto: CreateProjectDto) {
    const result = await this.projectsService.create(req.user.id, dto);
    
    // Generate master wallets for all enabled chains
    try {
      await this.walletsService.generateMasterWalletsForProject(result.project.id);
    } catch (error) {
      console.error(`Failed to generate master wallets for project ${result.project.id}:`, error);
      // Don't fail project creation if wallet generation fails
    }
    
    return {
      project: result.project,
      apiKey: result.apiKey,
      message: 'Store this API key securely. It will not be shown again.',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all projects for authenticated user' })
  @ApiResponse({ status: 200, description: 'List of projects' })
  async findAll(@Request() req) {
    return this.projectsService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiResponse({ status: 200, description: 'Project details' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findOne(@Request() req, @Param('id') id: number) {
    return this.projectsService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project details' })
  @ApiResponse({ status: 200, description: 'Project updated successfully' })
  @ApiBody({ type: UpdateProjectDto })
  async update(@Request() req, @Param('id') id: number, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(req.user.id, id, dto);
  }

  @Post(':id/regenerate-key')
  @ApiOperation({ summary: 'Regenerate API key for project' })
  @ApiResponse({ status: 200, description: 'New API key generated' })
  async regenerateKey(@Request() req, @Param('id') id: number) {
    const newApiKey = await this.projectsService.regenerateKey(req.user.id, id);
    return {
      apiKey: newApiKey,
      message: 'New API key generated. Update your integration immediately.',
    };
  }

  @Get(':id/settings')
  @ApiOperation({ summary: 'Get project settings' })
  @ApiResponse({ status: 200, description: 'Project settings' })
  async getSettings(@Request() req, @Param('id') id: number) {
    return this.projectsService.getSettings(req.user.id, id);
  }

  @Patch(':id/settings')
  @ApiOperation({ summary: 'Update project settings' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  @ApiBody({ type: UpdateSettingsDto })
  async updateSettings(@Request() req, @Param('id') id: number, @Body() dto: UpdateSettingsDto) {
    return this.projectsService.updateSettings(req.user.id, id, dto);
  }

  @Get(':id/master-wallets')
  @ApiOperation({ summary: 'Get master wallets for project (no balances - fast)' })
  async getMasterWallets(@Request() req, @Param('id') id: number) {
    return this.walletsService.getMasterWallets(req.user.id, id);
  }

  @Get(':id/master-wallets/:walletId/balance')
  @ApiOperation({ summary: 'Get balance for a single master wallet' })
  async getMasterWalletBalance(@Request() req, @Param('id') id: number, @Param('walletId') walletId: number) {
    return this.walletsService.getMasterWalletBalance(req.user.id, id, walletId);
  }

  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('logo', {
    storage: diskStorage({
      destination: './uploads/logos',
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${extname(file.originalname)}`;
        cb(null, uniqueName);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|svg\+xml|webp)$/)) {
        cb(new Error('Only image files are allowed'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  }))
  @ApiOperation({ summary: 'Upload project logo' })
  @ApiResponse({ status: 200, description: 'Logo uploaded successfully' })
  async uploadLogo(@Request() req, @Param('id') id: number, @UploadedFile() file: Express.Multer.File) {
    return this.projectsService.updateLogo(req.user.id, id, `/uploads/logos/${file.filename}`);
  }

  @Delete(':id/logo')
  @ApiOperation({ summary: 'Remove project logo' })
  @ApiResponse({ status: 200, description: 'Logo removed successfully' })
  async removeLogo(@Request() req, @Param('id') id: number) {
    return this.projectsService.removeLogo(req.user.id, id);
  }

  @Get(':id/master-wallets/:walletId/assets')
  @ApiOperation({ summary: 'Get master wallet assets (native + USDT)' })
  @ApiResponse({ status: 200, description: 'Master wallet assets retrieved successfully' })
  async getMasterWalletAssets(@Request() req, @Param('id') id: number, @Param('walletId') walletId: number) {
    return this.walletsService.getMasterWalletAssets(req.user.id, id, walletId);
  }

  @Post(':id/master-wallets/:walletId/send')
  @ApiOperation({ summary: 'Send token from master wallet' })
  @ApiResponse({ status: 200, description: 'Token sent successfully' })
  async sendFromMasterWallet(@Request() req, @Param('id') id: number, @Param('walletId') walletId: number, @Body() dto: { to: string; amount: string; tokenType: 'native' | 'usdt' }) {
    return this.walletsService.sendFromMasterWallet(req.user.id, id, walletId, dto);
  }
}