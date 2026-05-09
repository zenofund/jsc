/**
 * Run Bank Module Migration Script
 * 
 * This script runs the SQL migration to create bank module tables
 * 
 * Run with: node scripts/run-bank-migration.js (from src/backend directory)
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
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Defined' : 'Undefined');
    
    await client.connect();
    log(colors.green, '✅', 'Connected to database');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/008_create_bank_module_tables.sql');
    
    if (!fs.existsSync(migrationPath)) {
      log(colors.red, '❌', 'Migration file not found!');
      log(colors.yellow, '💡', `Expected at: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    log(colors.blue, 'ℹ️', 'Migration file loaded');

    console.log('\n' + '='.repeat(60));
    log(colors.yellow, '🔄', 'Running Bank Module Migration...');
    console.log('='.repeat(60) + '\n');

    // Run the migration
    await client.query(migrationSQL);

    console.log('\n' + '='.repeat(60));
    log(colors.green, '✅', 'Migration completed successfully!');
    console.log('='.repeat(60) + '\n');

    // Verify the result
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'bank_accounts', 
        'payment_batches', 
        'payment_transactions', 
        'bank_statements',
        'bank_statement_lines',
        'payment_reconciliations',
        'payment_exceptions'
      )
    `);

    if (result.rows.length > 0) {
      log(colors.cyan, '📊', 'Created Tables:');
      result.rows.forEach(row => {
        log(colors.blue, '  →', row.table_name);
      });
    }

    console.log('\n' + '='.repeat(60));
    log(colors.green, '🎉', 'All Done!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.log('\n' + '='.repeat(60));
    log(colors.red, '❌', 'Migration failed!');
    console.log('='.repeat(60) + '\n');
    log(colors.red, 'Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
    log(colors.green, '✅', 'Database connection closed');
  }
}

// Run the migration
console.log('\n' + '='.repeat(60));
log(colors.yellow, '🚀', 'Bank Module Migration Runner');
console.log('='.repeat(60) + '\n');

runMigration();
