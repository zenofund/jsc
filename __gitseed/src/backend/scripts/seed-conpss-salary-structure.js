/**
 * Seed CONPSS Salary Structure Script
 * 
 * This script creates the official CONPSS (Consolidated Public Service Salary Structure)
 * in the database with MONTHLY salary data (converted from annual values)
 * 
 * Original data: Annual salaries
 * Stored data: Monthly salaries (Annual ÷ 12)
 * 
 * Run with: node backend/scripts/seed-conpss-salary-structure.js
 */

const { Client } = require('pg');
require('dotenv').config({ path: './.env' });

// Database connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Official CONPSS 2024 Salary Structure
// Note: All values are MONTHLY salaries (Annual values from document ÷ 12)
const conpssSalaryStructure = {
  name: 'CONPSS 2024',
  code: 'CONPSS-2024',
  effective_date: '2024-01-01',
  description: 'Consolidated Public Service Salary Structure 2024 - Monthly Pay (converted from annual)',
  status: 'active',
  grade_levels: [
    {
      level: 1,
      steps: [
        { step: 1, basic_salary: 75624 },   // Annual: 907,490
        { step: 2, basic_salary: 76746 },   // Annual: 920,950
        { step: 3, basic_salary: 77921 },
        { step: 4, basic_salary: 79121 },
        { step: 5, basic_salary: 80354 },
        { step: 6, basic_salary: 81614 },
        { step: 7, basic_salary: 82903 },
        { step: 8, basic_salary: 84221 },
        { step: 9, basic_salary: 85570 },
        { step: 10, basic_salary: 86951 },
        { step: 11, basic_salary: 88365 },
        { step: 12, basic_salary: 89812 },
        { step: 13, basic_salary: 91293 },
        { step: 14, basic_salary: 92810 },
        { step: 15, basic_salary: 94356 }
      ]
    },
    {
      level: 2,
      steps: [
        { step: 1, basic_salary: 81246 },
        { step: 2, basic_salary: 82491 },
        { step: 3, basic_salary: 83773 },
        { step: 4, basic_salary: 85097 },
        { step: 5, basic_salary: 86466 },
        { step: 6, basic_salary: 87876 },
        { step: 7, basic_salary: 89332 },
        { step: 8, basic_salary: 90836 },
        { step: 9, basic_salary: 92390 },
        { step: 10, basic_salary: 93993 },
        { step: 11, basic_salary: 95647 },
        { step: 12, basic_salary: 97355 },
        { step: 13, basic_salary: 99117 },
        { step: 14, basic_salary: 100936 },
        { step: 15, basic_salary: 102812 }
      ]
    },
    {
      level: 3,
      steps: [
        { step: 1, basic_salary: 87136 },
        { step: 2, basic_salary: 88500 },
        { step: 3, basic_salary: 89910 },
        { step: 4, basic_salary: 91370 },
        { step: 5, basic_salary: 92883 },
        { step: 6, basic_salary: 94451 },
        { step: 7, basic_salary: 96076 },
        { step: 8, basic_salary: 97761 },
        { step: 9, basic_salary: 99509 },
        { step: 10, basic_salary: 101322 },
        { step: 11, basic_salary: 103203 },
        { step: 12, basic_salary: 105154 },
        { step: 13, basic_salary: 107179 },
        { step: 14, basic_salary: 109281 },
        { step: 15, basic_salary: 111462 }
      ]
    },
    {
      level: 4,
      steps: [
        { step: 1, basic_salary: 93385 },
        { step: 2, basic_salary: 94882 },
        { step: 3, basic_salary: 96428 },
        { step: 4, basic_salary: 98025 },
        { step: 5, basic_salary: 99678 },
        { step: 6, basic_salary: 101391 },
        { step: 7, basic_salary: 103168 },
        { step: 8, basic_salary: 105013 },
        { step: 9, basic_salary: 106930 },
        { step: 10, basic_salary: 108925 },
        { step: 11, basic_salary: 110167 },
        { step: 12, basic_salary: 113162 },
        { step: 13, basic_salary: 115415 },
        { step: 14, basic_salary: 117763 },
        { step: 15, basic_salary: 120212 }
      ]
    },
    {
      level: 5,
      steps: [
        { step: 1, basic_salary: 100022 },
        { step: 2, basic_salary: 101656 },
        { step: 3, basic_salary: 103342 },
        { step: 4, basic_salary: 105086 },
        { step: 5, basic_salary: 106891 },
        { step: 6, basic_salary: 108763 },
        { step: 7, basic_salary: 110706 },
        { step: 8, basic_salary: 112726 },
        { step: 9, basic_salary: 114827 },
        { step: 10, basic_salary: 117014 },
        { step: 11, basic_salary: 119294 },
        { step: 12, basic_salary: 121672 },
        { step: 13, basic_salary: 124154 },
        { step: 14, basic_salary: 126745 },
        { step: 15, basic_salary: 129454 }
      ]
    },
    {
      level: 6,
      steps: [
        { step: 1, basic_salary: 107081 },
        { step: 2, basic_salary: 108862 },
        { step: 3, basic_salary: 110703 },
        { step: 4, basic_salary: 112608 },
        { step: 5, basic_salary: 114582 },
        { step: 6, basic_salary: 116631 },
        { step: 7, basic_salary: 118760 },
        { step: 8, basic_salary: 120974 },
        { step: 9, basic_salary: 123281 },
        { step: 10, basic_salary: 125686 },
        { step: 11, basic_salary: 128195 },
        { step: 12, basic_salary: 130815 },
        { step: 13, basic_salary: 133554 },
        { step: 14, basic_salary: 136418 },
        { step: 15, basic_salary: 139415 }
      ]
    },
    {
      level: 7,
      steps: [
        { step: 1, basic_salary: 114580 },
        { step: 2, basic_salary: 116519 },
        { step: 3, basic_salary: 118524 },
        { step: 4, basic_salary: 120600 },
        { step: 5, basic_salary: 122753 },
        { step: 6, basic_salary: 124989 },
        { step: 7, basic_salary: 127314 },
        { step: 8, basic_salary: 129736 },
        { step: 9, basic_salary: 132260 },
        { step: 10, basic_salary: 134895 },
        { step: 11, basic_salary: 137648 },
        { step: 12, basic_salary: 140527 },
        { step: 13, basic_salary: 143540 },
        { step: 14, basic_salary: 146696 },
        { step: 15, basic_salary: 150004 }
      ]
    },
    {
      level: 8,
      steps: [
        { step: 1, basic_salary: 122621 },
        { step: 2, basic_salary: 124732 },
        { step: 3, basic_salary: 126912 },
        { step: 4, basic_salary: 129170 },
        { step: 5, basic_salary: 131510 },
        { step: 6, basic_salary: 133941 },
        { step: 7, basic_salary: 136467 },
        { step: 8, basic_salary: 139097 },
        { step: 9, basic_salary: 141839 },
        { step: 10, basic_salary: 144699 },
        { step: 11, basic_salary: 147686 },
        { step: 12, basic_salary: 150809 },
        { step: 13, basic_salary: 154076 },
        { step: 14, basic_salary: 157498 },
        { step: 15, basic_salary: 161084 }
      ]
    },
    {
      level: 9,
      steps: [
        { step: 1, basic_salary: 131233 },
        { step: 2, basic_salary: 133520 },
        { step: 3, basic_salary: 135881 },
        { step: 4, basic_salary: 138324 },
        { step: 5, basic_salary: 140854 },
        { step: 6, basic_salary: 143480 },
        { step: 7, basic_salary: 146209 },
        { step: 8, basic_salary: 149049 },
        { step: 9, basic_salary: 152007 },
        { step: 10, basic_salary: 155093 },
        { step: 11, basic_salary: 158315 },
        { step: 12, basic_salary: 161683 },
        { step: 13, basic_salary: 165207 },
        { step: 14, basic_salary: 168896 },
        { step: 15, basic_salary: 172763 }
      ]
    },
    {
      level: 10,
      steps: [
        { step: 1, basic_salary: 140448 },
        { step: 2, basic_salary: 142930 },
        { step: 3, basic_salary: 145490 },
        { step: 4, basic_salary: 148138 },
        { step: 5, basic_salary: 150879 },
        { step: 6, basic_salary: 153723 },
        { step: 7, basic_salary: 156678 },
        { step: 8, basic_salary: 159753 },
        { step: 9, basic_salary: 162957 },
        { step: 10, basic_salary: 166300 },
        { step: 11, basic_salary: 169791 },
        { step: 12, basic_salary: 173442 },
        { step: 13, basic_salary: 177262 },
        { step: 14, basic_salary: 181263 },
        { step: 15, basic_salary: 185458 }
      ]
    },
    {
      level: 11,
      steps: [
        { step: 1, basic_salary: 150373 },
        { step: 2, basic_salary: 153062 },
        { step: 3, basic_salary: 155835 },
        { step: 4, basic_salary: 158699 },
        { step: 5, basic_salary: 161664 },
        { step: 6, basic_salary: 164738 },
        { step: 7, basic_salary: 167930 },
        { step: 8, basic_salary: 171250 },
        { step: 9, basic_salary: 174707 },
        { step: 10, basic_salary: 178313 },
        { step: 11, basic_salary: 182078 },
        { step: 12, basic_salary: 186013 },
        { step: 13, basic_salary: 190130 },
        { step: 14, basic_salary: 194442 },
        { step: 15, basic_salary: 198962 }
      ]
    },
    {
      level: 12,
      steps: [
        { step: 1, basic_salary: 161110 },
        { step: 2, basic_salary: 164029 },
        { step: 3, basic_salary: 167037 },
        { step: 4, basic_salary: 170142 },
        { step: 5, basic_salary: 173354 },
        { step: 6, basic_salary: 176683 },
        { step: 7, basic_salary: 180138 },
        { step: 8, basic_salary: 183731 },
        { step: 9, basic_salary: 187473 },
        { step: 10, basic_salary: 191375 },
        { step: 11, basic_salary: 195450 },
        { step: 12, basic_salary: 199712 },
        { step: 13, basic_salary: 204174 },
        { step: 14, basic_salary: 208852 },
        { step: 15, basic_salary: 213760 }
      ]
    },
    {
      level: 13,
      steps: [
        { step: 1, basic_salary: 172700 },
        { step: 2, basic_salary: 175878 },
        { step: 3, basic_salary: 179158 },
        { step: 4, basic_salary: 182549 },
        { step: 5, basic_salary: 186062 },
        { step: 6, basic_salary: 189708 },
        { step: 7, basic_salary: 193498 },
        { step: 8, basic_salary: 197444 },
        { step: 9, basic_salary: 201558 },
        { step: 10, basic_salary: 205854 },
        { step: 11, basic_salary: 210346 },
        { step: 12, basic_salary: 215048 },
        { step: 13, basic_salary: 219977 },
        { step: 14, basic_salary: 225148 },
        { step: 15, basic_salary: 230579 }
      ]
    },
    {
      level: 14,
      steps: [
        { step: 1, basic_salary: 185194 },
        { step: 2, basic_salary: 188648 },
        { step: 3, basic_salary: 192211 },
        { step: 4, basic_salary: 195893 },
        { step: 5, basic_salary: 199704 },
        { step: 6, basic_salary: 203656 },
        { step: 7, basic_salary: 207760 },
        { step: 8, basic_salary: 212029 },
        { step: 9, basic_salary: 216477 },
        { step: 10, basic_salary: 221118 },
        { step: 11, basic_salary: 225967 },
        { step: 12, basic_salary: 231039 },
        { step: 13, basic_salary: 236353 },
        { step: 14, basic_salary: 241925 },
        { step: 15, basic_salary: 247775 }
      ]
    },
    {
      level: 15,
      steps: [
        { step: 1, basic_salary: 198724 },
        { step: 2, basic_salary: 202478 },
        { step: 3, basic_salary: 206349 },
        { step: 4, basic_salary: 210346 },
        { step: 5, basic_salary: 214483 },
        { step: 6, basic_salary: 218770 },
        { step: 7, basic_salary: 223221 },
        { step: 8, basic_salary: 227849 },
        { step: 9, basic_salary: 232668 }
      ]
    },
    {
      level: 16,
      steps: [
        { step: 1, basic_salary: 213365 },
        { step: 2, basic_salary: 217432 },
        { step: 3, basic_salary: 221627 },
        { step: 4, basic_salary: 225961 },
        { step: 5, basic_salary: 230447 },
        { step: 6, basic_salary: 235098 },
        { step: 7, basic_salary: 239927 },
        { step: 8, basic_salary: 244948 },
        { step: 9, basic_salary: 250176 }
      ]
    },
    {
      level: 17,
      steps: [
        { step: 1, basic_salary: 229234 },
        { step: 2, basic_salary: 233651 },
        { step: 3, basic_salary: 238215 },
        { step: 4, basic_salary: 242936 },
        { step: 5, basic_salary: 247830 },
        { step: 6, basic_salary: 252911 },
        { step: 7, basic_salary: 258194 },
        { step: 8, basic_salary: 263695 },
        { step: 9, basic_salary: 269432 }
      ]
    }
  ]
};

async function seedConpssSalaryStructure() {
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

    // Delete old CONMESS structures (incorrect naming)
    const deleteResult = await client.query(
      'DELETE FROM salary_structures WHERE code LIKE $1 RETURNING code',
      ['CONMESS%']
    );
    
    if (deleteResult.rowCount > 0) {
      console.log(`🗑️  Removed ${deleteResult.rowCount} old CONMESS structure(s)`);
    }

    // Check if CONPSS-2024 already exists
    const existingCheck = await client.query(
      'SELECT id, status FROM salary_structures WHERE code = $1',
      ['CONPSS-2024']
    );

    if (existingCheck.rows.length > 0) {
      console.log('ℹ️  CONPSS-2024 already exists - updating with correct data');
      
      // Update it with the correct data
      await client.query(
        `UPDATE salary_structures 
         SET grade_levels = $1, 
             description = $2,
             status = 'active',
             updated_at = NOW() 
         WHERE code = $3`,
        [
          JSON.stringify(conpssSalaryStructure.grade_levels),
          conpssSalaryStructure.description,
          'CONPSS-2024'
        ]
      );
      console.log('✅ Updated CONPSS-2024 structure with monthly salary data');
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
          conpssSalaryStructure.name,
          conpssSalaryStructure.code,
          conpssSalaryStructure.effective_date,
          conpssSalaryStructure.description,
          JSON.stringify(conpssSalaryStructure.grade_levels),
          conpssSalaryStructure.status
        ]
      );

      console.log('✅ Created new CONPSS salary structure:');
      console.log(`   ID: ${result.rows[0].id}`);
      console.log(`   Name: ${result.rows[0].name}`);
      console.log(`   Code: ${result.rows[0].code}`);
    }

    // Verify the structure
    const verification = await client.query(
      'SELECT id, name, code, status, grade_levels FROM salary_structures WHERE code = $1',
      ['CONPSS-2024']
    );

    if (verification.rows.length > 0) {
      const structure = verification.rows[0];
      const gradeLevels = structure.grade_levels;
      
      console.log('\n📊 CONPSS Salary Structure Summary:');
      console.log(`   Name: ${structure.name}`);
      console.log(`   Code: ${structure.code}`);
      console.log(`   Status: ${structure.status}`);
      console.log(`   Pay Frequency: MONTHLY`);
      console.log(`   Grade Levels: ${gradeLevels.length} (GL1 - GL${gradeLevels.length})`);
      console.log(`   Steps per level: ${gradeLevels[0].steps.length}`);
      
      const minSalary = gradeLevels[0].steps[0].basic_salary;
      const maxSalary = gradeLevels[gradeLevels.length - 1].steps[gradeLevels[gradeLevels.length - 1].steps.length - 1].basic_salary;
      
      console.log(`   Monthly Salary Range: ₦${minSalary.toLocaleString()} - ₦${maxSalary.toLocaleString()}`);
      console.log(`   Annual Equivalent: ₦${(minSalary * 12).toLocaleString()} - ₦${(maxSalary * 12).toLocaleString()}`);
      
      console.log('\n💰 Sample Monthly Salaries (Official CONPSS):');
      console.log(`   GL1  Step 1:  ₦${gradeLevels[0].steps[0].basic_salary.toLocaleString()}  (Annual: ₦${(gradeLevels[0].steps[0].basic_salary * 12).toLocaleString()})`);
      console.log(`   GL7  Step 1:  ₦${gradeLevels[6].steps[0].basic_salary.toLocaleString()}  (Annual: ₦${(gradeLevels[6].steps[0].basic_salary * 12).toLocaleString()})`);
      console.log(`   GL10 Step 1:  ₦${gradeLevels[9].steps[0].basic_salary.toLocaleString()}  (Annual: ₦${(gradeLevels[9].steps[0].basic_salary * 12).toLocaleString()})`);
      console.log(`   GL12 Step 1:  ₦${gradeLevels[11].steps[0].basic_salary.toLocaleString()}  (Annual: ₦${(gradeLevels[11].steps[0].basic_salary * 12).toLocaleString()})`);
      console.log(`   GL15 Step 9:  ₦${gradeLevels[14].steps[8].basic_salary.toLocaleString()}  (Annual: ₦${(gradeLevels[14].steps[8].basic_salary * 12).toLocaleString()}) [Senior - 9 steps]`);
      console.log(`   GL17 Step 9:  ₦${gradeLevels[16].steps[8].basic_salary.toLocaleString()}  (Annual: ₦${(gradeLevels[16].steps[8].basic_salary * 12).toLocaleString()}) [Director - 9 steps]`);
    }

    console.log('\n✅ CONPSS salary structure seeding completed successfully!');
    console.log('📄 Source: Official CONPSS Salary Structure Document');
    console.log('💡 Note: All salaries stored as MONTHLY values (Annual ÷ 12)');

  } catch (error) {
    console.error('❌ Error seeding CONPSS salary structure:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('✅ Database connection closed');
  }
}

// Run the seeder
seedConpssSalaryStructure();