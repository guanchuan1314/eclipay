import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { AuthService } from '../auth/auth.service';

interface CreateProjectDto {
  name: string;
  webhookUrl?: string;
  environment?: 'testnet' | 'mainnet';
}

interface UpdateProjectDto {
  name?: string;
  webhookUrl?: string;
  logoUrl?: string;
  businessName?: string;
  businessAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly authService: AuthService,
  ) {}

  async create(userId: number, dto: CreateProjectDto): Promise<{ project: any; apiKey: string }> {
    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate API key
    const apiKey = this.authService.generateApiKey();
    const hashedApiKey = await bcrypt.hash(apiKey, 10);

    // Create project
    const project = this.projectRepository.create({
      user_id: userId,
      name: dto.name,
      api_key_hash: hashedApiKey,
      webhook_url: dto.webhookUrl,
      environment: dto.environment || 'testnet',
    });

    const savedProject = await this.projectRepository.save(project);

    return {
      project: {
        id: savedProject.id,
        name: savedProject.name,
        webhookUrl: savedProject.webhook_url,
        active: savedProject.active,
        environment: savedProject.environment,
        createdAt: savedProject.created_at,
      },
      apiKey, // Return plaintext API key only once
    };
  }

  async findAll(userId: number): Promise<any[]> {
    const projects = await this.projectRepository.find({
      where: { user_id: userId, active: true },
      order: { created_at: 'DESC' },
    });

    return projects.map(project => ({
      id: project.id,
      name: project.name,
      webhookUrl: project.webhook_url,
      active: project.active,
      environment: project.environment,
      logoUrl: project.logo_url,
      businessName: project.business_name,
      businessAddress: project.business_address,
      contactEmail: project.contact_email,
      contactPhone: project.contact_phone,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    }));
  }

  async findOne(userId: number, projectId: number): Promise<any> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, user_id: userId, active: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return {
      id: project.id,
      name: project.name,
      webhookUrl: project.webhook_url,
      active: project.active,
      environment: project.environment,
      logoUrl: project.logo_url,
      businessName: project.business_name,
      businessAddress: project.business_address,
      contactEmail: project.contact_email,
      contactPhone: project.contact_phone,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    };
  }

  async update(userId: number, projectId: number, dto: UpdateProjectDto): Promise<any> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, user_id: userId, active: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.projectRepository.update(projectId, {
      name: dto.name || project.name,
      webhook_url: dto.webhookUrl !== undefined ? dto.webhookUrl : project.webhook_url,
      logo_url: dto.logoUrl !== undefined ? dto.logoUrl : project.logo_url,
      business_name: dto.businessName !== undefined ? dto.businessName : project.business_name,
      business_address: dto.businessAddress !== undefined ? dto.businessAddress : project.business_address,
      contact_email: dto.contactEmail !== undefined ? dto.contactEmail : project.contact_email,
      contact_phone: dto.contactPhone !== undefined ? dto.contactPhone : project.contact_phone,
    });

    return this.findOne(userId, projectId);
  }

  async regenerateKey(userId: number, projectId: number): Promise<string> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, user_id: userId, active: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Generate new API key
    const apiKey = this.authService.generateApiKey();
    const hashedApiKey = await bcrypt.hash(apiKey, 10);

    await this.projectRepository.update(projectId, {
      api_key_hash: hashedApiKey,
    });

    return apiKey;
  }

  async getSettings(userId: number, projectId: number): Promise<any> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, user_id: userId, active: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return {
      id: project.id,
      name: project.name,
      webhookUrl: project.webhook_url,
      logoUrl: project.logo_url,
      businessName: project.business_name,
      businessAddress: project.business_address,
      contactEmail: project.contact_email,
      contactPhone: project.contact_phone,
      apiKey: this.maskApiKey(project.api_key_hash),
    };
  }

  async updateSettings(userId: number, projectId: number, settings: { name?: string; webhookUrl?: string; logoUrl?: string; businessName?: string; businessAddress?: string; contactEmail?: string; contactPhone?: string }): Promise<any> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, user_id: userId, active: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.projectRepository.update(projectId, {
      name: settings.name !== undefined ? settings.name : project.name,
      webhook_url: settings.webhookUrl !== undefined ? settings.webhookUrl : project.webhook_url,
      logo_url: settings.logoUrl !== undefined ? settings.logoUrl : project.logo_url,
      business_name: settings.businessName !== undefined ? settings.businessName : project.business_name,
      business_address: settings.businessAddress !== undefined ? settings.businessAddress : project.business_address,
      contact_email: settings.contactEmail !== undefined ? settings.contactEmail : project.contact_email,
      contact_phone: settings.contactPhone !== undefined ? settings.contactPhone : project.contact_phone,
    });

    return this.getSettings(userId, projectId);
  }

  async validateOwnership(userId: number, projectId: number): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, user_id: userId, active: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async updateLogo(userId: number, projectId: number, logoPath: string): Promise<any> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, user_id: userId, active: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Delete old logo file if it exists
    if (project.logo_url && project.logo_url.startsWith('/uploads/')) {
      const oldFilePath = path.join(process.cwd(), project.logo_url);
      try {
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      } catch (error) {
        console.error('Failed to delete old logo file:', error);
      }
    }

    // Update project with new logo path
    await this.projectRepository.update(projectId, {
      logo_url: logoPath,
    });

    return this.findOne(userId, projectId);
  }

  async removeLogo(userId: number, projectId: number): Promise<any> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, user_id: userId, active: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Delete logo file if it exists
    if (project.logo_url && project.logo_url.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), project.logo_url);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error('Failed to delete logo file:', error);
      }
    }

    // Update project to remove logo
    await this.projectRepository.update(projectId, {
      logo_url: null,
    });

    return this.findOne(userId, projectId);
  }

  private maskApiKey(hashedKey: string): string {
    return 'eclipay_••••••••••••••••••••••••••••••••';
  }
}