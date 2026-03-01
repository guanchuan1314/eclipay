import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

describe('ProjectsController (Integration)', () => {
  let app: INestApplication;
  let projectRepository: Repository<Project>;
  let userRepository: Repository<User>;
  let authToken: string;
  let userId: number;

  const testUser = {
    username: 'projectuser',
    email: 'project@example.com',
    password: 'testpassword123'
  };

  const testProject = {
    name: 'Test Project',
    description: 'A test project for integration tests'
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            host: configService.get('DB_HOST', 'localhost'),
            port: configService.get('DB_PORT', 5432),
            username: configService.get('DB_USER', 'postgres'),
            password: configService.get('DB_PASSWORD', 'password'),
            database: configService.get('DB_NAME', 'eclipay_test'),
            entities: [User, Project],
            synchronize: true,
            dropSchema: true,
          }),
          inject: [ConfigService],
        }),
        TypeOrmModule.forFeature([User, Project]),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            secret: configService.get('JWT_SECRET', 'test-secret'),
            signOptions: { expiresIn: '1h' },
          }),
          inject: [ConfigService],
        }),
      ],
      controllers: [ProjectsController],
      providers: [ProjectsService, AuthService, UsersService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    projectRepository = moduleFixture.get<Repository<Project>>(getRepositoryToken(Project));
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));

    // Create test user and get auth token
    const user = await userRepository.save({
      username: testUser.username,
      email: testUser.email,
      password: await bcrypt.hash(testUser.password, 10),
    });
    userId = user.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: testUser.username,
        password: testUser.password,
      });

    authToken = loginResponse.body.access_token;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /projects', () => {
    it('should create project and return 201 with apiKey', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testProject)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('api_key');
      expect(response.body.name).toBe(testProject.name);
      expect(response.body.description).toBe(testProject.description);
      expect(response.body.user_id).toBe(userId);
    });

    it('should return 401 when creating project without auth', async () => {
      await request(app.getHttpServer())
        .post('/projects')
        .send(testProject)
        .expect(401);
    });
  });

  describe('GET /projects', () => {
    beforeEach(async () => {
      // Create test projects
      await projectRepository.save([
        {
          name: 'Project 1',
          description: 'First project',
          user_id: userId,
          api_key: 'test-key-1',
        },
        {
          name: 'Project 2',
          description: 'Second project',
          user_id: userId,
          api_key: 'test-key-2',
        },
      ]);
    });

    it('should list projects and return 200 with array', async () => {
      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('api_key');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get('/projects')
        .expect(401);
    });
  });

  describe('GET /projects/:id', () => {
    let projectId: number;
    let otherUserId: number;
    let otherProjectId: number;

    beforeEach(async () => {
      // Create project for current user
      const project = await projectRepository.save({
        name: 'User Project',
        description: 'Project owned by user',
        user_id: userId,
        api_key: 'user-key',
      });
      projectId = project.id;

      // Create another user and their project
      const otherUser = await userRepository.save({
        username: 'otheruser',
        email: 'other@example.com',
        password: await bcrypt.hash('password', 10),
      });
      otherUserId = otherUser.id;

      const otherProject = await projectRepository.save({
        name: 'Other Project',
        description: 'Project owned by other user',
        user_id: otherUserId,
        api_key: 'other-key',
      });
      otherProjectId = otherProject.id;
    });

    it('should get project by ID and return 200', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(projectId);
      expect(response.body.user_id).toBe(userId);
    });

    it('should return 403 when accessing project not owned by user', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${otherProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent project', async () => {
      await request(app.getHttpServer())
        .get('/projects/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PUT /projects/:id', () => {
    let projectId: number;

    beforeEach(async () => {
      const project = await projectRepository.save({
        name: 'Original Name',
        description: 'Original description',
        user_id: userId,
        api_key: 'original-key',
      });
      projectId = project.id;
    });

    it('should update project and return 200', async () => {
      const updateData = {
        name: 'Updated Name',
        description: 'Updated description'
      };

      const response = await request(app.getHttpServer())
        .put(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.description).toBe(updateData.description);
    });
  });

  describe('POST /projects/:id/regenerate-key', () => {
    let projectId: number;
    let originalApiKey: string;

    beforeEach(async () => {
      const project = await projectRepository.save({
        name: 'Key Project',
        description: 'Project for key regeneration',
        user_id: userId,
        api_key: 'original-api-key',
      });
      projectId = project.id;
      originalApiKey = project.api_key;
    });

    it('should regenerate API key and return 200 with new key', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${projectId}/regenerate-key`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('api_key');
      expect(response.body.api_key).not.toBe(originalApiKey);
      expect(response.body.api_key).toMatch(/^ek_[a-f0-9]+$/);
    });
  });

  describe('GET /projects/:id/settings', () => {
    let projectId: number;

    beforeEach(async () => {
      const project = await projectRepository.save({
        name: 'Settings Project',
        description: 'Project for settings test',
        user_id: userId,
        api_key: 'settings-key',
        webhook_url: 'https://example.com/webhook',
      });
      projectId = project.id;
    });

    it('should get project settings and return 200', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/settings`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('webhook_url');
      expect(response.body.webhook_url).toBe('https://example.com/webhook');
    });
  });

  describe('PUT /projects/:id/settings', () => {
    let projectId: number;

    beforeEach(async () => {
      const project = await projectRepository.save({
        name: 'Settings Update Project',
        description: 'Project for settings update test',
        user_id: userId,
        api_key: 'settings-update-key',
      });
      projectId = project.id;
    });

    it('should update project settings (webhook URL) and return 200', async () => {
      const updateData = {
        webhook_url: 'https://newwebhook.example.com/callback'
      };

      const response = await request(app.getHttpServer())
        .put(`/projects/${projectId}/settings`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.webhook_url).toBe(updateData.webhook_url);
    });
  });
});