import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { ProjectsService } from '../projects/projects.service';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { Invoice } from '../database/entities/invoice.entity';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { Chain } from '../database/entities/chain.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

describe('InvoicesController (Integration)', () => {
  let app: INestApplication;
  let invoiceRepository: Repository<Invoice>;
  let projectRepository: Repository<Project>;
  let userRepository: Repository<User>;
  let chainRepository: Repository<Chain>;
  let authToken: string;
  let userId: number;
  let projectId: number;
  let apiKey: string;

  const testUser = {
    username: 'invoiceuser',
    email: 'invoice@example.com',
    password: 'testpassword123'
  };

  const testInvoice = {
    amount: '100.50',
    currency: 'USDT',
    chain_id: 1,
    description: 'Test payment invoice',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
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
            entities: [User, Project, Chain, Invoice],
            synchronize: true,
            dropSchema: true,
          }),
          inject: [ConfigService],
        }),
        TypeOrmModule.forFeature([User, Project, Chain, Invoice]),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            secret: configService.get('JWT_SECRET', 'test-secret'),
            signOptions: { expiresIn: '1h' },
          }),
          inject: [ConfigService],
        }),
      ],
      controllers: [InvoicesController],
      providers: [
        InvoicesService,
        ProjectsService,
        AuthService,
        UsersService,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get repositories
    invoiceRepository = moduleFixture.get<Repository<Invoice>>(getRepositoryToken(Invoice));
    projectRepository = moduleFixture.get<Repository<Project>>(getRepositoryToken(Project));
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    chainRepository = moduleFixture.get<Repository<Chain>>(getRepositoryToken(Chain));

    // Create test chain
    await chainRepository.save({
      id: 1,
      name: 'Ethereum',
      standard: 'EVM',
      gas_token: 'ETH',
      usdt_contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      rpc_url: 'https://mainnet.infura.io/v3/test',
      enabled: true,
    });

    // Create test user
    const user = await userRepository.save({
      username: testUser.username,
      email: testUser.email,
      password: await bcrypt.hash(testUser.password, 10),
    });
    userId = user.id;

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: testUser.username,
        password: testUser.password,
      });
    authToken = loginResponse.body.access_token;

    // Create test project
    const project = await projectRepository.save({
      name: 'Test Invoice Project',
      description: 'Project for invoice testing',
      user_id: userId,
      api_key: 'test-invoice-api-key',
    });
    projectId = project.id;
    apiKey = project.api_key;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /projects/:projectId/invoices', () => {
    it('should create invoice and return 201', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${projectId}/invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(testInvoice)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('invoice_id'); // UUID
      expect(response.body).toHaveProperty('payment_address');
      expect(response.body.amount).toBe(testInvoice.amount);
      expect(response.body.currency).toBe(testInvoice.currency);
      expect(response.body.chain_id).toBe(testInvoice.chain_id);
      expect(response.body.project_id).toBe(projectId);
      expect(response.body.status).toBe('pending');
      expect(response.body).toHaveProperty('qr_code_url');
    });

    it('should create invoice with API key', async () => {
      const response = await request(app.getHttpServer())
        .post('/invoices')
        .set('X-API-Key', apiKey)
        .send({
          ...testInvoice,
          project_id: projectId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('invoice_id');
      expect(response.body.project_id).toBe(projectId);
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/invoices`)
        .send(testInvoice)
        .expect(401);
    });

    it('should return 400 with invalid amount', async () => {
      const invalidInvoice = { ...testInvoice, amount: 'invalid' };
      
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidInvoice)
        .expect(400);
    });

    it('should return 400 with missing required fields', async () => {
      const incompleteInvoice = { amount: '100' }; // missing currency, chain_id
      
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteInvoice)
        .expect(400);
    });
  });

  describe('GET /projects/:projectId/invoices', () => {
    beforeEach(async () => {
      // Create test invoices
      await invoiceRepository.save([
        {
          invoice_id: 'inv_test_001',
          project_id: projectId,
          chain_id: 1,
          amount: '50.00',
          currency: 'USDT',
          status: 'pending',
          payment_address: '0x1111111111111111111111111111111111111111',
          description: 'Test invoice 1',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        {
          invoice_id: 'inv_test_002',
          project_id: projectId,
          chain_id: 1,
          amount: '25.75',
          currency: 'USDT',
          status: 'paid',
          payment_address: '0x2222222222222222222222222222222222222222',
          description: 'Test invoice 2',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      ]);
    });

    it('should list invoices for project and return 200', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('invoice_id');
      expect(response.body[0]).toHaveProperty('amount');
      expect(response.body[0]).toHaveProperty('status');
      expect(response.body[0].project_id).toBe(projectId);
    });

    it('should filter invoices by status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/invoices?status=paid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe('paid');
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${projectId}/invoices`)
        .expect(401);
    });
  });

  describe('GET /projects/:projectId/invoices/:invoiceId', () => {
    let invoiceId: string;

    beforeEach(async () => {
      const invoice = await invoiceRepository.save({
        invoice_id: 'inv_test_single',
        project_id: projectId,
        chain_id: 1,
        amount: '75.00',
        currency: 'USDT',
        status: 'pending',
        payment_address: '0x3333333333333333333333333333333333333333',
        description: 'Single test invoice',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      invoiceId = invoice.invoice_id;
    });

    it('should get invoice by ID and return 200', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.invoice_id).toBe(invoiceId);
      expect(response.body.project_id).toBe(projectId);
      expect(response.body).toHaveProperty('amount');
      expect(response.body).toHaveProperty('payment_address');
      expect(response.body).toHaveProperty('qr_code_url');
    });

    it('should get invoice with API key', async () => {
      const response = await request(app.getHttpServer())
        .get(`/invoices/${invoiceId}`)
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body.invoice_id).toBe(invoiceId);
    });

    it('should return 404 for non-existent invoice', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${projectId}/invoices/non-existent`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PUT /projects/:projectId/invoices/:invoiceId/cancel', () => {
    let invoiceId: string;

    beforeEach(async () => {
      const invoice = await invoiceRepository.save({
        invoice_id: 'inv_test_cancel',
        project_id: projectId,
        chain_id: 1,
        amount: '125.00',
        currency: 'USDT',
        status: 'pending',
        payment_address: '0x4444444444444444444444444444444444444444',
        description: 'Cancel test invoice',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      invoiceId = invoice.invoice_id;
    });

    it('should cancel invoice and return 200', async () => {
      const response = await request(app.getHttpServer())
        .put(`/projects/${projectId}/invoices/${invoiceId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.invoice_id).toBe(invoiceId);
      expect(response.body.status).toBe('cancelled');
    });

    it('should return 400 when trying to cancel non-pending invoice', async () => {
      // First cancel the invoice
      await invoiceRepository.update(
        { invoice_id: invoiceId },
        { status: 'paid' }
      );

      await request(app.getHttpServer())
        .put(`/projects/${projectId}/invoices/${invoiceId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Invoice Status Management', () => {
    it('should create invoices with different statuses', async () => {
      const statuses = ['pending', 'paid', 'expired', 'cancelled'];
      
      for (let i = 0; i < statuses.length; i++) {
        await invoiceRepository.save({
          invoice_id: `inv_status_${i}`,
          project_id: projectId,
          chain_id: 1,
          amount: '10.00',
          currency: 'USDT',
          status: statuses[i] as any,
          payment_address: `0x${i.toString().repeat(40)}`,
          description: `Status test ${statuses[i]}`,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      }

      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const returnedStatuses = response.body.map(invoice => invoice.status);
      statuses.forEach(status => {
        expect(returnedStatuses).toContain(status);
      });
    });

    it('should handle invoice expiration', async () => {
      // Create expired invoice (past date)
      const expiredInvoice = await invoiceRepository.save({
        invoice_id: 'inv_expired_test',
        project_id: projectId,
        chain_id: 1,
        amount: '50.00',
        currency: 'USDT',
        status: 'pending',
        payment_address: '0x5555555555555555555555555555555555555555',
        description: 'Expired invoice test',
        expires_at: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      });

      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/invoices/${expiredInvoice.invoice_id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should still return the invoice, but application logic should handle expiration
      expect(response.body.invoice_id).toBe(expiredInvoice.invoice_id);
      expect(new Date(response.body.expires_at)).toBeLessThan(new Date());
    });
  });
});