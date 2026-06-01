const { Client } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const sqlPath = path.resolve(__dirname, '../migrations/055_create_app_permissions.sql');
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Migration file not found at: ${sqlPath}`);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  await client.connect();
  console.log('Connected to database');

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration 055_create_app_permissions.sql applied');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error?.message || error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error('Migration runner failed:', e?.message || e);
  process.exit(1);
});
