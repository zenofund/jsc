/**
 * Seed Salary Structure Script
 * 
 * This script creates a default CONMESS salary structure in the database
 * Run with: node backend/scripts/seed-salary-structure.js
 */

const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

// Database connection using environment variables
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// CONMESS 2024 Salary Structure
const salaryStructure = {
  name: 'CONMESS 2024',
  code: 'CONMESS-2024',
  effective_date: '2024-01-01',
  description: 'Consolidated Medical Salary Structure 2024',
  status: 'active',
  grade_levels: [
    {
      level: 1,
      steps: [
        { step: 1, basic_salary: 80000 },
        { step: 2, basic_salary: 85000 },
        { step: 3, basic_salary: 90000 },
        { step: 4, basic_salary: 95000 },
        { step: 5, basic_salary: 100000 },
      ]
    },
    {
      level: 2,
      steps: [
        { step: 1, basic_salary: 105000 },
        { step: 2, basic_salary: 110000 },
        { step: 3, basic_salary: 115000 },
        { step: 4, basic_salary: 120000 },
        { step: 5, basic_salary: 125000 },
      ]
    },
    {
      level: 3,
      steps: [
        { step: 1, basic_salary: 130000 },
        { step: 2, basic_salary: 135000 },
        { step: 3, basic_salary: 140000 },
        { step: 4, basic_salary: 145000 },
        { step: 5, basic_salary: 150000 },
      ]
    },
    {
      level: 4,
      steps: [
        { step: 1, basic_salary: 155000 },
        { step: 2, basic_salary: 160000 },
        { step: 3, basic_salary: 165000 },
        { step: 4, basic_salary: 170000 },
        { step: 5, basic_salary: 175000 },
      ]
    },
    {
      level: 5,
      steps: [
        { step: 1, basic_salary: 180000 },
        { step: 2, basic_salary: 185000 },
        { step: 3, basic_salary: 190000 },
        { step: 4, basic_salary: 195000 },
        { step: 5, basic_salary: 200000 },
      ]
    },
    {
      level: 6,
      steps: [
        { step: 1, basic_salary: 210000 },
        { step: 2, basic_salary: 220000 },
        { step: 3, basic_salary: 230000 },
        { step: 4, basic_salary: 240000 },
        { step: 5, basic_salary: 250000 },
      ]
    },
    {
      level: 7,
      steps: [
        { step: 1, basic_salary: 260000 },
        { step: 2, basic_salary: 270000 },
        { step: 3, basic_salary: 280000 },
        { step: 4, basic_salary: 290000 },
        { step: 5, basic_salary: 300000 },
      ]
    },
    {
      level: 8,
      steps: [
        { step: 1, basic_salary: 320000 },
        { step: 2, basic_salary: 335000 },
        { step: 3, basic_salary: 350000 },
        { step: 4, basic_salary: 365000 },
        { step: 5, basic_salary: 380000 },
      ]
    },
    {
      level: 9,
      steps: [
        { step: 1, basic_salary: 400000 },
        { step: 2, basic_salary: 420000 },
        { step: 3, basic_salary: 440000 },
        { step: 4, basic_salary: 460000 },
        { step: 5, basic_salary: 480000 },
      ]
    },
    {
      level: 10,
      steps: [
        { step: 1, basic_salary: 500000 },
        { step: 2, basic_salary: 525000 },
        { step: 3, basic_salary: 550000 },
        { step: 4, basic_salary: 575000 },
        { step: 5, basic_salary: 600000 },
      ]
    },
    {
      level: 11,
      steps: [
        { step: 1, basic_salary: 625000 },
        { step: 2, basic_salary: 650000 },
        { step: 3, basic_salary: 675000 },
        { step: 4, basic_salary: 700000 },
        { step: 5, basic_salary: 725000 },
      ]
    },
    {
      level: 12,
      steps: [
        { step: 1, basic_salary: 750000 },
        { step: 2, basic_salary: 780000 },
        { step: 3, basic_salary: 810000 },
        { step: 4, basic_salary: 840000 },
        { step: 5, basic_salary: 870000 },
      ]
    },
    {
      level: 13,
      steps: [
        { step: 1, basic_salary: 900000 },
        { step: 2, basic_salary: 935000 },
        { step: 3, basic_salary: 970000 },
        { step: 4, basic_salary: 1005000 },
        { step: 5, basic_salary: 1040000 },
      ]
    },
    {
      level: 14,
      steps: [
        { step: 1, basic_salary: 1075000 },
        { step: 2, basic_salary: 1115000 },
        { step: 3, basic_salary: 1155000 },
        { step: 4, basic_salary: 1195000 },
        { step: 5, basic_salary: 1235000 },
      ]
    },
    {
      level: 15,
      steps: [
        { step: 1, basic_salary: 1280000 },
        { step: 2, basic_salary: 1325000 },
        { step: 3, basic_salary: 1370000 },
        { step: 4, basic_salary: 1415000 },
        { step: 5, basic_salary: 1460000 },
      ]
    },
    {
      level: 16,
      steps: [
        { step: 1, basic_salary: 1510000 },
        { step: 2, basic_salary: 1560000 },
        { step: 3, basic_salary: 1610000 },
        { step: 4, basic_salary: 1660000 },
        { step: 5, basic_salary: 1710000 },
      ]
    },
    {
      level: 17,
      steps: [
        { step: 1, basic_salary: 1765000 },
        { step: 2, basic_salary: 1820000 },
        { step: 3, basic_salary: 1875000 },
        { step: 4, basic_salary: 1930000 },
        { step: 5, basic_salary: 1985000 },
      ]
    },
  ]
};

async function seedSalaryStructure() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if salary_structures table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'salary_structures'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ salary_structures table does not exist. Creating it...');
      
      // Create the table
      await client.query(`
        CREATE TABLE IF NOT EXISTS salary_structures (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          code VARCHAR(100) UNIQUE NOT NULL,
          effective_date DATE NOT NULL,
          description TEXT,
          grade_levels JSONB NOT NULL,
          status VARCHAR(50) DEFAULT 'active',
          created_by UUID,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      
      console.log('✅ Created salary_structures table');
    }

    // Check if CONMESS-2024 already exists
    const existingCheck = await client.query(
      'SELECT id, status FROM salary_structures WHERE code = $1',
      ['CONMESS-2024']
    );

    if (existingCheck.rows.length > 0) {
      console.log('ℹ️  CONMESS-2024 already exists');
      
      if (existingCheck.rows[0].status !== 'active') {
        // Activate it
        await client.query(
          'UPDATE salary_structures SET status = $1, updated_at = NOW() WHERE code = $2',
          ['active', 'CONMESS-2024']
        );
        console.log('✅ Activated existing CONMESS-2024 structure');
      } else {
        console.log('✅ CONMESS-2024 is already active');
      }
    } else {
      // Deactivate all other structures
      await client.query(
        'UPDATE salary_structures SET status = $1, updated_at = NOW() WHERE status = $2',
        ['inactive', 'active']
      );

      // Insert new structure
      const result = await client.query(
        `INSERT INTO salary_structures (
          name, code, effective_date, description, grade_levels, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, code`,
        [
          salaryStructure.name,
          salaryStructure.code,
          salaryStructure.effective_date,
          salaryStructure.description,
          JSON.stringify(salaryStructure.grade_levels),
          salaryStructure.status
        ]
      );

      console.log('✅ Created new salary structure:');
      console.log(`   ID: ${result.rows[0].id}`);
      console.log(`   Name: ${result.rows[0].name}`);
      console.log(`   Code: ${result.rows[0].code}`);
      console.log(`   Grade Levels: ${salaryStructure.grade_levels.length}`);
      console.log(`   Status: active`);
    }

    // Verify the structure
    const verification = await client.query(
      'SELECT id, name, code, status, grade_levels FROM salary_structures WHERE code = $1',
      ['CONMESS-2024']
    );

    if (verification.rows.length > 0) {
      const structure = verification.rows[0];
      const gradeLevels = structure.grade_levels;
      console.log('\n📊 Salary Structure Summary:');
      console.log(`   Name: ${structure.name}`);
      console.log(`   Code: ${structure.code}`);
      console.log(`   Status: ${structure.status}`);
      console.log(`   Grade Levels: ${gradeLevels.length} (GL1 - GL${gradeLevels.length})`);
      console.log(`   Steps per level: 5`);
      console.log(`   Salary range: ₦${gradeLevels[0].steps[0].basic_salary.toLocaleString()} - ₦${gradeLevels[gradeLevels.length - 1].steps[4].basic_salary.toLocaleString()}`);
      
      // Show a few sample salaries
      console.log('\n💰 Sample Salaries:');
      console.log(`   GL7 Step 1: ₦${gradeLevels[6].steps[0].basic_salary.toLocaleString()}`);
      console.log(`   GL8 Step 1: ₦${gradeLevels[7].steps[0].basic_salary.toLocaleString()}`);
      console.log(`   GL10 Step 1: ₦${gradeLevels[9].steps[0].basic_salary.toLocaleString()}`);
      console.log(`   GL12 Step 1: ₦${gradeLevels[11].steps[0].basic_salary.toLocaleString()}`);
    }

    console.log('\n✅ Salary structure seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding salary structure:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('✅ Database connection closed');
  }
}

// Run the seeder
seedSalaryStructure();
