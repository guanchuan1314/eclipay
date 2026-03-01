-- Add sub-wallet types and encrypted private key columns
-- Migration 005: Sub-wallet types and private key storage

-- Add type column
ALTER TABLE sub_wallets ADD COLUMN IF NOT EXISTS type VARCHAR(10) DEFAULT 'payment';

-- Add encrypted private key column
ALTER TABLE sub_wallets ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT;

-- Update existing records to be payment type
UPDATE sub_wallets SET type = 'payment' WHERE type IS NULL;

-- Add constraint to ensure type is valid
ALTER TABLE sub_wallets ADD CONSTRAINT chk_sub_wallet_type 
CHECK (type IN ('payment', 'client'));

-- Create index for better query performance on type
CREATE INDEX IF NOT EXISTS idx_sub_wallets_type_approved ON sub_wallets(type, approved);