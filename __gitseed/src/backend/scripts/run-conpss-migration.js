/**
 * Run CONPSS Migration Script
 * 
 * This script runs the SQL migration to update the salary_structures table
 * with official CONPSS monthly salary data
 * 
 * Run with: node backend/scripts/run-conpss-migration.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

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
    await client.connect();
    log(colors.green, '✅', 'Connected to database');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/001_update_salary_structure_to_conpss.sql');
    
    if (!fs.existsSync(migrationPath)) {
      log(colors.red, '❌', 'Migration file not found!');
      log(colors.yellow, '💡', 'Expected at: backend/migrations/001_update_salary_structure_to_conpss.sql');
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    log(colors.blue, 'ℹ️', 'Migration file loaded');

    console.log('\n' + '='.repeat(60));
    log(colors.yellow, '🔄', 'Running CONPSS Migration...');
    console.log('='.repeat(60) + '\n');

    // Run the migration
    await client.query(migrationSQL);

    console.log('\n' + '='.repeat(60));
    log(colors.green, '✅', 'Migration completed successfully!');
    console.log('='.repeat(60) + '\n');

    // Verify the result
    const result = await client.query(`
      SELECT 
        name, 
        code, 
        status, 
        jsonb_array_length(grade_levels) as grade_count,
        jsonb_array_length(grade_levels->0->'steps') as steps_per_grade
      FROM salary_structures 
      WHERE code = 'CONPSS-2024'
    `);

    if (result.rows.length > 0) {
      const structure = result.rows[0];
      log(colors.cyan, '📊', 'CONPSS Salary Structure Summary:');
      log(colors.blue, '  →', `Name: ${structure.name}`);
      log(colors.blue, '  →', `Code: ${structure.code}`);
      log(colors.blue, '  →', `Status: ${structure.status}`);
      log(colors.blue, '  →', `Grade Levels: ${structure.grade_count}`);
      log(colors.blue, '  →', `Steps per Grade: ${structure.steps_per_grade}`);

      // Get sample salaries
      const sampleQuery = await client.query(`
        SELECT 
          (grade_levels->0->'steps'->0->>'basic_salary')::integer as gl1_step1,
          (grade_levels->6->'steps'->0->>'basic_salary')::integer as gl7_step1,
          (grade_levels->16->'steps'->14->>'basic_salary')::integer as gl17_step15
        FROM salary_structures 
        WHERE code = 'CONPSS-2024'
      `);

      if (sampleQuery.rows.length > 0) {
        const salaries = sampleQuery.rows[0];
        console.log('');
        log(colors.cyan, '💰', 'Sample Monthly Salaries:');
        log(colors.blue, '  →', `GL1  Step 1:  ₦${salaries.gl1_step1.toLocaleString()}  (Annual: ₦${(salaries.gl1_step1 * 12).toLocaleString()})`);
        log(colors.blue, '  →', `GL7  Step 1:  ₦${salaries.gl7_step1.toLocaleString()}  (Annual: ₦${(salaries.gl7_step1 * 12).toLocaleString()})`);
        log(colors.blue, '  →', `GL17 Step 15: ₦${salaries.gl17_step15.toLocaleString()}  (Annual: ₦${(salaries.gl17_step15 * 12).toLocaleString()})`);
      }
    }

    console.log('\n' + '='.repeat(60));
    log(colors.green, '🎉', 'All Done!');
    log(colors.cyan, '  →', 'Your database now has official CONPSS monthly salaries');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.log('\n' + '='.repeat(60));
    log(colors.red, '❌', 'Migration failed!');
    console.log('='.repeat(60) + '\n');
    log(colors.red, 'Error:', error.message);
    
    if (error.message.includes('relation "salary_structures" does not exist')) {
      log(colors.yellow, '💡', 'The salary_structures table will be created by the migration');
    }
    
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
    log(colors.green, '✅', 'Database connection closed');
  }
}

// Run the migration
console.log('\n' + '='.repeat(60));
log(colors.yellow, '🚀', 'CONPSS Migration Runner');
log(colors.cyan, 'ℹ️', 'Converting annual CONPSS salaries to monthly values');
console.log('='.repeat(60) + '\n');

runMigration();
