import { Test, TestingModule } from '@nestjs/testing';
import { ChainFactory } from './chain.factory';
import { EthereumChain } from './implementations/ethereum.chain';
import { SolanaChain } from './implementations/solana.chain';
import { TronChain } from './implementations/tron.chain';
import { TonChain } from './implementations/ton.chain';

describe('Chain Factory', () => {
  let chainFactory: ChainFactory;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        ChainFactory,
        EthereumChain,
        SolanaChain,
        TronChain,
        TonChain,
      ],
    }).compile();

    chainFactory = moduleFixture.get<ChainFactory>(ChainFactory);
  });

  describe('Chain Creation', () => {
    it('should create EVM chains', async () => {
      const evmConfig = {
        id: 1,
        name: 'Ethereum',
        standard: 'EVM',
        gas_token: 'ETH',
        usdt_contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        rpc_url: 'https://mainnet.infura.io/v3/test',
        enabled: true,
      } as any;

      const chain = await chainFactory.createChain(evmConfig);
      expect(chain).toBeInstanceOf(EthereumChain);
      expect(chain.standard).toBe('EVM');
    });

    it('should create Solana chain', async () => {
      const solanaConfig = {
        id: 2,
        name: 'Solana',
        standard: 'SOLANA',
        gas_token: 'SOL',
        rpc_url: 'https://api.mainnet-beta.solana.com',
        enabled: true,
      } as any;

      const chain = await chainFactory.createChain(solanaConfig);
      expect(chain).toBeInstanceOf(SolanaChain);
      expect(chain.standard).toBe('SOLANA');
    });

    it('should create TRON chain', async () => {
      const tronConfig = {
        id: 3,
        name: 'Tron',
        standard: 'TRON',
        gas_token: 'TRX',
        rpc_url: 'https://api.trongrid.io',
        enabled: true,
      } as any;

      const chain = await chainFactory.createChain(tronConfig);
      expect(chain).toBeInstanceOf(TronChain);
      expect(chain.standard).toBe('TRON');
      // Note: TronWeb initialization might fail in test environment
    });

    it('should create TON chain', async () => {
      const tonConfig = {
        id: 4,
        name: 'TON',
        standard: 'TON',
        gas_token: 'TON',
        rpc_url: 'https://toncenter.com/api/v2/jsonRPC',
        enabled: true,
      } as any;

      const chain = await chainFactory.createChain(tonConfig);
      expect(chain).toBeInstanceOf(TonChain);
      expect(chain.standard).toBe('TON');
    });

    it('should throw error for unsupported chain standard', async () => {
      const unsupportedConfig = {
        id: 999,
        name: 'Unsupported',
        standard: 'UNKNOWN',
        gas_token: 'UNK',
        rpc_url: 'https://unknown.com',
        enabled: true,
      } as any;

      await expect(chainFactory.createChain(unsupportedConfig)).rejects.toThrow('Unsupported chain standard: UNKNOWN');
    });
  });

  describe('EVM Chain Support', () => {
    const evmChains = [
      { name: 'Ethereum', standard: 'EVM' },
      { name: 'BSC', standard: 'EVM' },
      { name: 'Polygon', standard: 'EVM' },
      { name: 'Arbitrum', standard: 'EVM' },
      { name: 'Optimism', standard: 'EVM' },
      { name: 'Avalanche', standard: 'EVM' },
    ];

    it.each(evmChains)('should support $name as EVM chain', async ({ name, standard }) => {
      const config = {
        id: 1,
        name,
        standard,
        gas_token: 'ETH',
        usdt_contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        rpc_url: 'https://rpc.example.com',
        enabled: true,
      } as any;

      const chain = await chainFactory.createChain(config);
      expect(chain).toBeInstanceOf(EthereumChain);
      expect(chain.standard).toBe('EVM');
      expect(chain.name).toBe(name);
    });
  });
});