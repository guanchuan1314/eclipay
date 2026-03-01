-- Multi-project architecture migration
-- This migration converts from single-merchant to multi-user, multi-project

-- Drop existing merchant constraints and indexes
ALTER TABLE sub_wallets DROP CONSTRAINT IF EXISTS sub_wallets_merchant_id_fkey;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_merchant_id_fkey;
DROP INDEX IF EXISTS idx_sub_wallets_merchant_chain;
DROP INDEX IF EXISTS idx_invoices_merchant;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    api_key_hash VARCHAR(255) NOT NULL,
    webhook_url TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add project_id to sub_wallets
ALTER TABLE sub_wallets ADD COLUMN IF NOT EXISTS project_id INTEGER;

-- Add project_id to invoices  
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_id INTEGER;

-- Add project_id to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS project_id INTEGER;

-- Drop old merchant_id columns
ALTER TABLE sub_wallets DROP COLUMN IF EXISTS merchant_id;
ALTER TABLE invoices DROP COLUMN IF EXISTS merchant_id;

-- Drop merchants table
DROP TABLE IF EXISTS merchants;

-- Add foreign key constraints for new project_id columns
ALTER TABLE sub_wallets ADD CONSTRAINT sub_wallets_project_id_fkey 
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE invoices ADD CONSTRAINT invoices_project_id_fkey 
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE transactions ADD CONSTRAINT transactions_project_id_fkey 
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_api_key_hash ON projects(api_key_hash);
CREATE INDEX idx_projects_active ON projects(active);
CREATE INDEX idx_sub_wallets_project_chain ON sub_wallets(project_id, chain_id);
CREATE INDEX idx_invoices_project ON invoices(project_id);
CREATE INDEX idx_transactions_project ON transactions(project_id);

-- Add unique constraint on project api_key_hash
ALTER TABLE projects ADD CONSTRAINT projects_api_key_hash_unique UNIQUE (api_key_hash);