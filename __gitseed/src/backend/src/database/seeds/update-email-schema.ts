import 'dotenv/config';
import { Client } from 'pg';

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set in environment');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    await client.query('BEGIN');

    const statements: string[] = [
      `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,

      `CREATE TABLE IF NOT EXISTS smtp_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        host VARCHAR(255) NOT NULL,
        port INTEGER NOT NULL DEFAULT 587,
        secure BOOLEAN DEFAULT false,
        username VARCHAR(255) NOT NULL,
        password_encrypted TEXT NOT NULL,
        from_email VARCHAR(255) NOT NULL,
        from_name VARCHAR(255) NOT NULL DEFAULT 'JSC Payroll System',
        is_active BOOLEAN DEFAULT true,
        last_tested_at TIMESTAMP,
        test_status VARCHAR(50),
        test_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID,
        updated_by UUID
      );`,

      `ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS from_name VARCHAR(255) NOT NULL DEFAULT 'JSC Payroll System';`,
      `ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS password_encrypted TEXT;`,
      `ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();`,
      `ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`,
      `ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS created_by UUID;`,
      `ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS updated_by UUID;`,
      `ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMP;`,
      `ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS test_status VARCHAR(50);`,
      `ALTER TABLE smtp_settings ADD COLUMN IF NOT EXISTS test_message TEXT;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_smtp_settings_active ON smtp_settings(is_active) WHERE is_active = true;`,

      `CREATE TABLE IF NOT EXISTS email_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        recipient_email VARCHAR(255) NOT NULL,
        recipient_name VARCHAR(255),
        subject VARCHAR(500) NOT NULL,
        template_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        error_message TEXT,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        user_id UUID,
        metadata JSONB
      );`,

      `ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS template_type VARCHAR(100) NOT NULL DEFAULT 'general';`,
      `ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS user_id UUID;`,
      `CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);`,
      `CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);`,
      `CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);`,
    ];

    for (const sql of statements) {
      console.log('→ Executing:', sql.split('\n')[0], '...');
      await client.query(sql);
    }

    await client.query('COMMIT');
    console.log('✅ Email schema migration completed successfully');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
