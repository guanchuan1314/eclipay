import { Injectable } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly projectsService: ProjectsService,
  ) {}

  async getSettings(userId: number, projectId: number) {
    return this.projectsService.getSettings(userId, projectId);
  }

  async updateSettings(userId: number, projectId: number, settings: { webhookUrl?: string }) {
    return this.projectsService.updateSettings(userId, projectId, settings);
  }
}