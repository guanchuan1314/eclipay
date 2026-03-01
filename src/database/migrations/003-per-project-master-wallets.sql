-- Per-project master wallets migration
-- This migration adds project_id to master_wallets and ensures one master wallet per chain per project

-- Step 1: Add project_id column to master_wallets (nullable first for migration)
ALTER TABLE master_wallets ADD COLUMN IF NOT EXISTS project_id INTEGER;

-- Step 2: Delete existing global master wallets (early dev, no real funds)
DELETE FROM master_wallets;

-- Step 3: Make project_id NOT NULL after cleanup
ALTER TABLE master_wallets ALTER COLUMN project_id SET NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE master_wallets ADD CONSTRAINT master_wallets_project_id_fkey 
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- Step 5: Add unique constraint: one master per chain per project
ALTER TABLE master_wallets ADD CONSTRAINT master_wallets_chain_project_unique 
    UNIQUE (chain_id, project_id);

-- Create index for efficient lookups
CREATE INDEX idx_master_wallets_project_id ON master_wallets(project_id);
CREATE INDEX idx_master_wallets_chain_project ON master_wallets(chain_id, project_id);