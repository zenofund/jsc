const { Client } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const migrationPath = path.resolve(__dirname, '../database/migrations/022_create_idempotency_keys.sql');
    console.log(`📝 Reading migration file: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🚀 Applying migration...');
    await client.query(sql);
    
    console.log('✅ Migration applied successfully!');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
