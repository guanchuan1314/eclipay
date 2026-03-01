-- Add project branding columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS business_address TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(100);