-- Add testnet/mainnet environment support

-- Step 1: Add is_testnet column to chains table
ALTER TABLE chains ADD COLUMN is_testnet BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Update existing chains to mark them as mainnet (is_testnet = false is already default)
UPDATE chains SET is_testnet = false WHERE is_testnet IS NULL;

-- Step 3: Insert testnet chains
INSERT INTO chains (name, standard, gas_token, rpc_url, usdt_contract, enabled, is_testnet) VALUES
('Ethereum Sepolia', 'EVM', 'ETH', 'https://rpc.sepolia.org', '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06', true, true),
('BSC Testnet', 'EVM', 'BNB', 'https://data-seed-prebsc-1-s1.binance.org:8545/', '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', true, true),
('Polygon Amoy', 'EVM', 'MATIC', 'https://rpc-amoy.polygon.technology/', '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', true, true),
('Arbitrum Sepolia', 'EVM', 'ETH', 'https://sepolia-rollup.arbitrum.io/rpc', '0x0000000000000000000000000000000000000000', true, true),
('Optimism Sepolia', 'EVM', 'ETH', 'https://sepolia.optimism.io', '0x0000000000000000000000000000000000000000', true, true),
('Avalanche Fuji', 'EVM', 'AVAX', 'https://api.avax-test.network/ext/bc/C/rpc', '0x0000000000000000000000000000000000000000', true, true),
('Tron Nile', 'TRON', 'TRX', 'https://nile.trongrid.io', 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj', true, true),
('Solana Devnet', 'SOLANA', 'SOL', 'https://api.devnet.solana.com', '', true, true);

-- Step 4: Add environment column to projects table
ALTER TABLE projects ADD COLUMN environment VARCHAR(10) NOT NULL DEFAULT 'testnet';

-- Step 5: Create indexes for better performance
CREATE INDEX idx_chains_is_testnet ON chains(is_testnet);
CREATE INDEX idx_chains_enabled_testnet ON chains(enabled, is_testnet);
CREATE INDEX idx_projects_environment ON projects(environment);