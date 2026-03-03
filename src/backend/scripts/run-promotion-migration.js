/**
 * Run Promotion Module Migration Script
 * 
 * This script runs the SQL migration to create promotion module tables
 * 
 * Run with: node scripts/run-promotion-migration.js (from src/backend directory)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

// Database connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, symbol, message) {
  console.log(`${color}${symbol} ${message}${colors.reset}`);
}

async function runMigration() {
  try {
    console.log('Connecting to database...');
    
    await client.connect();
    log(colors.green, '✅', 'Connected to database');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/009_create_promotion_tables.sql');
    
    if (!fs.existsSync(migrationPath)) {
      log(colors.red, '❌', 'Migration file not found!');
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    log(colors.blue, 'ℹ️', 'Migration file loaded');

    console.log('\n' + '='.repeat(60));
    log(colors.yellow, '🔄', 'Running Promotion Module Migration...');
    console.log('='.repeat(60) + '\n');

    // Run the migration
    await client.query(migrationSQL);

    console.log('\n' + '='.repeat(60));
    log(colors.green, '✅', 'Migration completed successfully!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.log('\n' + '='.repeat(60));
    log(colors.red, '❌', 'Migration failed!');
    log(colors.red, 'Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
