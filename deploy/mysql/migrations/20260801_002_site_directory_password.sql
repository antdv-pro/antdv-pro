ALTER TABLE transport_site_directory ADD COLUMN IF NOT EXISTS password_cipher VARCHAR(2048) NOT NULL DEFAULT '' AFTER username;
