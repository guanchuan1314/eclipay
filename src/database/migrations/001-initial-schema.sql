-- Initial database schema for EcliPay

-- Chains table
CREATE TABLE IF NOT EXISTS chains (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    standard VARCHAR(50) NOT NULL,
    gas_token VARCHAR(10) NOT NULL,
    rpc_url TEXT NOT NULL,
    usdt_contract VARCHAR(255),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Merchants table
CREATE TABLE IF NOT EXISTS merchants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    api_key_hash VARCHAR(255) UNIQUE NOT NULL,
    webhook_url TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Master wallets table
CREATE TABLE IF NOT EXISTS master_wallets (
    id SERIAL PRIMARY KEY,
    chain_id INTEGER REFERENCES chains(id),
    address VARCHAR(255) NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sub wallets table
CREATE TABLE IF NOT EXISTS sub_wallets (
    id SERIAL PRIMARY KEY,
    chain_id INTEGER REFERENCES chains(id),
    master_wallet_id INTEGER REFERENCES master_wallets(id),
    derivation_index INTEGER NOT NULL,
    address VARCHAR(255) NOT NULL,
    merchant_id INTEGER REFERENCES merchants(id),
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER REFERENCES merchants(id),
    sub_wallet_id INTEGER REFERENCES sub_wallets(id),
    chain_id INTEGER REFERENCES chains(id),
    amount DECIMAL(18,6) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    callback_url TEXT,
    external_id VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP NULL,
    expired_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    chain_id INTEGER REFERENCES chains(id),
    tx_hash VARCHAR(255) NOT NULL,
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255) NOT NULL,
    amount DECIMAL(18,6) NOT NULL,
    type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    confirmations INTEGER DEFAULT 0,
    block_number INTEGER,
    invoice_id INTEGER REFERENCES invoices(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_chains_enabled ON chains(enabled);
CREATE INDEX idx_merchants_active ON merchants(active);
CREATE INDEX idx_sub_wallets_merchant_chain ON sub_wallets(merchant_id, chain_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_merchant ON invoices(merchant_id);
CREATE INDEX idx_transactions_tx_hash ON transactions(tx_hash);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_chain ON transactions(chain_id);

-- Insert default chain configurations
INSERT INTO chains (name, standard, gas_token, rpc_url, usdt_contract, enabled) VALUES
('Ethereum', 'EVM', 'ETH', 'https://eth-mainnet.g.alchemy.com/v2/demo', '0xdAC17F958D2ee523a2206206994597C13D831ec7', true),
('BSC', 'EVM', 'BNB', 'https://bsc-dataseed.binance.org/', '0x55d398326f99059fF775485246999027B3197955', true),
('Polygon', 'EVM', 'MATIC', 'https://polygon-rpc.com/', '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', true),
('Arbitrum', 'EVM', 'ETH', 'https://arb1.arbitrum.io/rpc', '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', true),
('Optimism', 'EVM', 'ETH', 'https://mainnet.optimism.io', '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', true),
('Avalanche', 'EVM', 'AVAX', 'https://api.avax.network/ext/bc/C/rpc', '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', true),
('Tron', 'TRON', 'TRX', 'https://api.trongrid.io', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', true),
('Solana', 'SOLANA', 'SOL', 'https://api.mainnet-beta.solana.com', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', true),
('TON', 'TON', 'TON', 'https://toncenter.com/api/v2/jsonRPC', NULL, false);