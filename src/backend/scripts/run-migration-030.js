
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Running migration 030...');
    const migrationSQL = fs.readFileSync(path.join(__dirname, '../migrations/030_add_missing_cooperative_columns.sql'), 'utf8');
    await client.query(migrationSQL);
    console.log('Migration 030 ran successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();
