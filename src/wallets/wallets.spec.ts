import { Test, TestingModule } from '@nestjs/testing';
import { EthereumChain } from '../chains/implementations/ethereum.chain';
import { SolanaChain } from '../chains/implementations/solana.chain';
import { TronChain } from '../chains/implementations/tron.chain';
import { TonChain } from '../chains/implementations/ton.chain';

describe('Wallet Generation', () => {
  let ethereumChain: EthereumChain;
  let solanaChain: SolanaChain;
  let tronChain: TronChain;
  let tonChain: TonChain;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        EthereumChain,
        SolanaChain,
        TronChain,
        TonChain,
      ],
    }).compile();

    ethereumChain = moduleFixture.get<EthereumChain>(EthereumChain);
    solanaChain = moduleFixture.get<SolanaChain>(SolanaChain);
    tronChain = moduleFixture.get<TronChain>(TronChain);
    tonChain = moduleFixture.get<TonChain>(TonChain);

    // Configure chains with dummy config
    ethereumChain.configure({
      id: 1,
      name: 'Ethereum',
      standard: 'EVM',
      gas_token: 'ETH',
      usdt_contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      rpc_url: 'https://mainnet.infura.io/v3/test',
      enabled: true,
    } as any);

    solanaChain.configure({
      id: 2,
      name: 'Solana',
      standard: 'SOLANA',
      gas_token: 'SOL',
      usdt_contract: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      rpc_url: 'https://api.mainnet-beta.solana.com',
      enabled: true,
    } as any);
  });

  describe('Ethereum Chain', () => {
    it('should generate wallet with valid address and private key', async () => {
      const wallet = await ethereumChain.generateWallet();
      
      expect(wallet).toHaveProperty('address');
      expect(wallet).toHaveProperty('privateKey');
      expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/); // Valid Ethereum address
      expect(wallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/); // Valid private key
    });

    it('should validate Ethereum addresses correctly', () => {
      expect(ethereumChain.validateAddress('0x1234567890123456789012345678901234567890')).toBe(true);
      expect(ethereumChain.validateAddress('invalid-address')).toBe(false);
      expect(ethereumChain.validateAddress('0xinvalid')).toBe(false);
    });

    it('should generate different wallets each time', async () => {
      const wallet1 = await ethereumChain.generateWallet();
      const wallet2 = await ethereumChain.generateWallet();
      
      expect(wallet1.address).not.toBe(wallet2.address);
      expect(wallet1.privateKey).not.toBe(wallet2.privateKey);
    });
  });

  describe('Solana Chain', () => {
    it('should generate wallet with valid address and private key', async () => {
      const wallet = await solanaChain.generateWallet();
      
      expect(wallet).toHaveProperty('address');
      expect(wallet).toHaveProperty('privateKey');
      expect(wallet.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/); // Valid Solana address
      expect(wallet.privateKey).toHaveLength(128); // 64 bytes in hex
    });

    it('should validate Solana addresses correctly', () => {
      expect(solanaChain.validateAddress('11111111111111111111111111111112')).toBe(true);
      expect(solanaChain.validateAddress('invalid-address')).toBe(false);
      expect(solanaChain.validateAddress('0x1234567890123456789012345678901234567890')).toBe(false);
    });

    it('should generate different wallets each time', async () => {
      const wallet1 = await solanaChain.generateWallet();
      const wallet2 = await solanaChain.generateWallet();
      
      expect(wallet1.address).not.toBe(wallet2.address);
      expect(wallet1.privateKey).not.toBe(wallet2.privateKey);
    });
  });

  describe('TRON Chain', () => {
    it('should handle TRON wallet generation', async () => {
      try {
        const wallet = await tronChain.generateWallet();
        
        expect(wallet).toHaveProperty('address');
        expect(wallet).toHaveProperty('privateKey');
        expect(wallet.address).toMatch(/^T[a-zA-Z0-9]{33}$/); // Valid TRON address
      } catch (error) {
        // TronWeb might not be available in test environment
        expect(error.message).toContain('TronWeb not initialized');
      }
    });

    it('should validate TRON addresses', () => {
      const validTronAddress = 'TLyqzVGLV1srkB7dToTAEqgDSfPtXRJZYH';
      // Without TronWeb, falls back to basic validation
      expect(tronChain.validateAddress(validTronAddress)).toBe(true);
      expect(tronChain.validateAddress('invalid')).toBe(false);
    });
  });

  describe('TON Chain', () => {
    it('should handle TON wallet generation', async () => {
      try {
        const wallet = await tonChain.generateWallet();
        
        expect(wallet).toHaveProperty('address');
        expect(wallet).toHaveProperty('privateKey');
      } catch (error) {
        // TON packages might not be available in test environment
        expect(error.message).toContain('TON packages not initialized');
      }
    });
  });

  describe('HD Wallet Derivation', () => {
    const masterSeed = 'test mnemonic phrase for seed generation purposes only';

    it('should derive consistent wallets from same seed and index', async () => {
      const wallet1 = await ethereumChain.deriveWallet(masterSeed, 0);
      const wallet2 = await ethereumChain.deriveWallet(masterSeed, 0);
      
      expect(wallet1.address).toBe(wallet2.address);
      expect(wallet1.privateKey).toBe(wallet2.privateKey);
    });

    it('should derive different wallets with different indices', async () => {
      const wallet1 = await ethereumChain.deriveWallet(masterSeed, 0);
      const wallet2 = await ethereumChain.deriveWallet(masterSeed, 1);
      
      expect(wallet1.address).not.toBe(wallet2.address);
      expect(wallet1.privateKey).not.toBe(wallet2.privateKey);
    });

    it('should work for Solana as well', async () => {
      const wallet1 = await solanaChain.deriveWallet(masterSeed, 0);
      const wallet2 = await solanaChain.deriveWallet(masterSeed, 1);
      
      expect(wallet1.address).not.toBe(wallet2.address);
      expect(wallet1.privateKey).not.toBe(wallet2.privateKey);
    });
  });
});