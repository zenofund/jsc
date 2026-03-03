/**
 * Run Settings Migration Script
 * 
 * This script runs the SQL migration to create and populate the system_settings table.
 * 
 * Run with: node scripts/run-settings-migration.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
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
    await client.connect();
    log(colors.green, '✅', 'Connected to database');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/026_create_system_settings.sql');
    
    if (!fs.existsSync(migrationPath)) {
      log(colors.red, '❌', 'Migration file not found!');
      log(colors.yellow, '💡', `Expected at: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    log(colors.blue, 'ℹ️', 'Migration file loaded');

    console.log('\n' + '='.repeat(60));
    log(colors.yellow, '🔄', 'Running Settings Migration...');
    console.log('='.repeat(60) + '\n');

    // Run the migration
    await client.query(migrationSQL);

    console.log('\n' + '='.repeat(60));
    log(colors.green, '✅', 'Migration completed successfully!');
    console.log('='.repeat(60) + '\n');

    // Verify the result
    const result = await client.query(`
      SELECT * FROM system_settings WHERE key = 'general_settings'
    `);

    if (result.rows.length > 0) {
      log(colors.cyan, '📊', 'System Settings Created:');
      console.log(JSON.stringify(result.rows[0].value, null, 2));
    }

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
log(colors.yellow, '🚀', 'Settings Migration Runner');
console.log('='.repeat(60) + '\n');

runMigration();
