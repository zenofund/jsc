const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function runMigration() {
  try {
    await client.connect();
    const migrationSQL = fs.readFileSync(path.join(__dirname, '../migrations/043_update_leave_types_and_balances.sql'), 'utf8');
    await client.query(migrationSQL);
    console.log('Migration 043 ran successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
