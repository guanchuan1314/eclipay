import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { ProjectsService } from '../projects/projects.service';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { Transaction } from '../database/entities/transaction.entity';
import { Project } from '../database/entities/project.entity';
import { User } from '../database/entities/user.entity';
import { Chain } from '../database/entities/chain.entity';
import { Invoice } from '../database/entities/invoice.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

describe('TransactionsController (Integration)', () => {
  let app: INestApplication;
  let transactionRepository: Repository<Transaction>;
  let projectRepository: Repository<Project>;
  let userRepository: Repository<User>;
  let chainRepository: Repository<Chain>;
  let invoiceRepository: Repository<Invoice>;
  let authToken: string;
  let userId: number;
  let projectId: number;
  let apiKey: string;

  const testUser = {
    username: 'transactionuser',
    email: 'transaction@example.com',
    password: 'testpassword123'
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
            entities: [User, Project, Chain, Invoice, Transaction],
            synchronize: true,
            dropSchema: true,
          }),
          inject: [ConfigService],
        }),
        TypeOrmModule.forFeature([User, Project, Chain, Invoice, Transaction]),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            secret: configService.get('JWT_SECRET', 'test-secret'),
            signOptions: { expiresIn: '1h' },
          }),
          inject: [ConfigService],
        }),
      ],
      controllers: [TransactionsController],
      providers: [
        TransactionsService,
        ProjectsService,
        AuthService,
        UsersService,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get repositories
    transactionRepository = moduleFixture.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    projectRepository = moduleFixture.get<Repository<Project>>(getRepositoryToken(Project));
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    chainRepository = moduleFixture.get<Repository<Chain>>(getRepositoryToken(Chain));
    invoiceRepository = moduleFixture.get<Repository<Invoice>>(getRepositoryToken(Invoice));

    // Create test chains
    await chainRepository.save([
      {
        id: 1,
        name: 'Ethereum',
        standard: 'EVM',
        gas_token: 'ETH',
        usdt_contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        rpc_url: 'https://mainnet.infura.io/v3/test',
        enabled: true,
      },
      {
        id: 2,
        name: 'Polygon',
        standard: 'EVM',
        gas_token: 'MATIC',
        usdt_contract: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        rpc_url: 'https://polygon-rpc.com',
        enabled: true,
      },
    ]);

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
      name: 'Test Transaction Project',
      description: 'Project for transaction testing',
      user_id: userId,
      api_key: 'test-transaction-api-key',
    });
    projectId = project.id;
    apiKey = project.api_key;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /projects/:projectId/transactions', () => {
    beforeEach(async () => {
      // Create test invoice
      const invoice = await invoiceRepository.save({
        invoice_id: 'inv_transaction_test',
        project_id: projectId,
        chain_id: 1,
        amount: '100.00',
        currency: 'USDT',
        status: 'paid',
        payment_address: '0x1111111111111111111111111111111111111111',
      });

      // Create test transactions
      await transactionRepository.save([
        {
          hash: '0xabc123def456ghi789jkl012mno345pqr678stu901vwx234yzabc456def789ghi012',
          chain_id: 1,
          project_id: projectId,
          invoice_id: invoice.id,
          from_address: '0x2222222222222222222222222222222222222222',
          to_address: '0x1111111111111111111111111111111111111111',
          amount: '100.000000',
          currency: 'USDT',
          confirmations: 12,
          status: 'confirmed',
          block_number: 18500000,
          gas_used: '21000',
          gas_price: '20000000000',
        },
        {
          hash: '0x123abc456def789ghi012jkl345mno678pqr901stu234vwx567yzabc890def123ghi456',
          chain_id: 2,
          project_id: projectId,
          from_address: '0x3333333333333333333333333333333333333333',
          to_address: '0x4444444444444444444444444444444444444444',
          amount: '50.000000',
          currency: 'USDT',
          confirmations: 25,
          status: 'confirmed',
          block_number: 48500000,
          gas_used: '21000',
          gas_price: '30000000000',
        },
      ]);
    });

    it('should list transactions and return 200', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      
      response.body.forEach(transaction => {
        expect(transaction).toHaveProperty('id');
        expect(transaction).toHaveProperty('hash');
        expect(transaction).toHaveProperty('chain_id');
        expect(transaction).toHaveProperty('amount');
        expect(transaction).toHaveProperty('status');
        expect(transaction).toHaveProperty('confirmations');
        expect(transaction.project_id).toBe(projectId);
      });
    });

    it('should filter transactions by chain', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions?chain_id=1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].chain_id).toBe(1);
    });

    it('should filter transactions by status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions?status=confirmed`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach(transaction => {
        expect(transaction.status).toBe('confirmed');
      });
    });

    it('should paginate transactions', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions?limit=1&offset=0`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
    });

    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions`)
        .expect(401);
    });
  });

  describe('GET /projects/:projectId/transactions/:id', () => {
    let transactionId: number;
    let transactionHash: string;

    beforeEach(async () => {
      const transaction = await transactionRepository.save({
        hash: '0xdef456ghi789jkl012mno345pqr678stu901vwx234yzabc456def789ghi012jkl345',
        chain_id: 1,
        project_id: projectId,
        from_address: '0x5555555555555555555555555555555555555555',
        to_address: '0x6666666666666666666666666666666666666666',
        amount: '200.000000',
        currency: 'USDT',
        confirmations: 15,
        status: 'confirmed',
        block_number: 18600000,
        gas_used: '25000',
        gas_price: '25000000000',
      });
      transactionId = transaction.id;
      transactionHash = transaction.hash;
    });

    it('should get transaction by ID and return 200', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(transactionId);
      expect(response.body.hash).toBe(transactionHash);
      expect(response.body.project_id).toBe(projectId);
      expect(response.body).toHaveProperty('amount');
      expect(response.body).toHaveProperty('confirmations');
      expect(response.body).toHaveProperty('gas_used');
      expect(response.body).toHaveProperty('gas_price');
    });

    it('should return 404 for non-existent transaction', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions/99999`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /projects/:projectId/transactions/hash/:hash', () => {
    let transactionHash: string;

    beforeEach(async () => {
      const transaction = await transactionRepository.save({
        hash: '0x789ghi012jkl345mno678pqr901stu234vwx567yzabc890def123ghi456jkl789mno012',
        chain_id: 1,
        project_id: projectId,
        from_address: '0x7777777777777777777777777777777777777777',
        to_address: '0x8888888888888888888888888888888888888888',
        amount: '75.500000',
        currency: 'USDT',
        confirmations: 8,
        status: 'pending',
        block_number: 18700000,
        gas_used: '21000',
        gas_price: '22000000000',
      });
      transactionHash = transaction.hash;
    });

    it('should get transaction by hash and return 200', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions/hash/${transactionHash}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.hash).toBe(transactionHash);
      expect(response.body.project_id).toBe(projectId);
      expect(response.body.amount).toBe('75.500000');
      expect(response.body.status).toBe('pending');
    });

    it('should get transaction by hash with API key', async () => {
      const response = await request(app.getHttpServer())
        .get(`/transactions/hash/${transactionHash}`)
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body.hash).toBe(transactionHash);
    });

    it('should return 404 for non-existent hash', async () => {
      const fakeHash = '0x1111111111111111111111111111111111111111111111111111111111111111';
      
      await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions/hash/${fakeHash}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 400 for invalid hash format', async () => {
      const invalidHash = 'not-a-valid-hash';
      
      await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions/hash/${invalidHash}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Transaction Status and Confirmations', () => {
    it('should handle different transaction statuses', async () => {
      const statuses = ['pending', 'confirmed', 'failed'];
      const transactions = [];

      for (let i = 0; i < statuses.length; i++) {
        const transaction = await transactionRepository.save({
          hash: `0x${'a'.repeat(64)}${i}`,
          chain_id: 1,
          project_id: projectId,
          from_address: `0x${'1'.repeat(40)}`,
          to_address: `0x${'2'.repeat(40)}`,
          amount: '10.000000',
          currency: 'USDT',
          confirmations: i * 5,
          status: statuses[i] as any,
          block_number: 18500000 + i,
        });
        transactions.push(transaction);
      }

      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const returnedStatuses = response.body.map(tx => tx.status);
      statuses.forEach(status => {
        expect(returnedStatuses).toContain(status);
      });
    });

    it('should track confirmation count accurately', async () => {
      const lowConfTransaction = await transactionRepository.save({
        hash: '0xlow' + 'a'.repeat(60),
        chain_id: 1,
        project_id: projectId,
        from_address: '0x1111111111111111111111111111111111111111',
        to_address: '0x2222222222222222222222222222222222222222',
        amount: '25.000000',
        currency: 'USDT',
        confirmations: 2,
        status: 'pending',
        block_number: 18500000,
      });

      const highConfTransaction = await transactionRepository.save({
        hash: '0xhigh' + 'b'.repeat(59),
        chain_id: 1,
        project_id: projectId,
        from_address: '0x3333333333333333333333333333333333333333',
        to_address: '0x4444444444444444444444444444444444444444',
        amount: '50.000000',
        currency: 'USDT',
        confirmations: 25,
        status: 'confirmed',
        block_number: 18500025,
      });

      // Get low confirmation transaction
      const lowResponse = await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions/${lowConfTransaction.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(lowResponse.body.confirmations).toBe(2);
      expect(lowResponse.body.status).toBe('pending');

      // Get high confirmation transaction
      const highResponse = await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions/${highConfTransaction.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(highResponse.body.confirmations).toBe(25);
      expect(highResponse.body.status).toBe('confirmed');
    });
  });

  describe('Gas and Fee Information', () => {
    it('should include gas information in transaction details', async () => {
      const transaction = await transactionRepository.save({
        hash: '0xgas' + 'c'.repeat(60),
        chain_id: 1,
        project_id: projectId,
        from_address: '0x1111111111111111111111111111111111111111',
        to_address: '0x2222222222222222222222222222222222222222',
        amount: '100.000000',
        currency: 'USDT',
        confirmations: 12,
        status: 'confirmed',
        block_number: 18500000,
        gas_used: '65000',
        gas_price: '50000000000', // 50 Gwei
      });

      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions/${transaction.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.gas_used).toBe('65000');
      expect(response.body.gas_price).toBe('50000000000');
      
      // Calculate expected gas fee: gas_used * gas_price
      const expectedGasFee = BigInt('65000') * BigInt('50000000000');
      expect(response.body).toHaveProperty('gas_used');
      expect(response.body).toHaveProperty('gas_price');
    });
  });

  describe('Multi-chain Transaction Support', () => {
    it('should handle transactions from different chains', async () => {
      // Create transactions on different chains
      const ethTransaction = await transactionRepository.save({
        hash: '0xeth' + 'd'.repeat(60),
        chain_id: 1, // Ethereum
        project_id: projectId,
        from_address: '0x1111111111111111111111111111111111111111',
        to_address: '0x2222222222222222222222222222222222222222',
        amount: '100.000000',
        currency: 'USDT',
        confirmations: 12,
        status: 'confirmed',
        block_number: 18500000,
      });

      const polygonTransaction = await transactionRepository.save({
        hash: '0xpoly' + 'e'.repeat(59),
        chain_id: 2, // Polygon
        project_id: projectId,
        from_address: '0x3333333333333333333333333333333333333333',
        to_address: '0x4444444444444444444444444444444444444444',
        amount: '50.000000',
        currency: 'USDT',
        confirmations: 25,
        status: 'confirmed',
        block_number: 48500000,
      });

      const allResponse = await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(allResponse.body).toHaveLength(2);

      const ethResponse = await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions?chain_id=1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(ethResponse.body).toHaveLength(1);
      expect(ethResponse.body[0].chain_id).toBe(1);

      const polygonResponse = await request(app.getHttpServer())
        .get(`/projects/${projectId}/transactions?chain_id=2`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(polygonResponse.body).toHaveLength(1);
      expect(polygonResponse.body[0].chain_id).toBe(2);
    });
  });
});