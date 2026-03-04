const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function runMigration() {
  try {
    await client.connect();
    const migrationSQL = fs.readFileSync(path.join(__dirname, '../migrations/044_cleanup_gender_specific_leave_balances.sql'), 'utf8');
    await client.query(migrationSQL);
    console.log('Migration 044 ran successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
