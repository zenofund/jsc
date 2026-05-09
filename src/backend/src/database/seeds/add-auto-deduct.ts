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
    
    // Check if column exists first to be safe
    const checkSql = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='cooperatives' AND column_name='auto_deduct_contribution';
    `;
    const checkRes = await client.query(checkSql);
    
    if (checkRes.rows.length > 0) {
        console.log('ℹ️ Column auto_deduct_contribution already exists.');
    } else {
        console.log('Running migration...');
        const sql = `ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS auto_deduct_contribution BOOLEAN DEFAULT FALSE;`;
        await client.query(sql);
        console.log('✅ Column auto_deduct_contribution added successfully.');
    }

  } catch (err: any) {
    console.error('❌ Migration failed:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
