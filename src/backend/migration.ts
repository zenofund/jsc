import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, './.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Add columns to deductions
    console.log('Adding columns to deductions...');
    await client.query(`
      ALTER TABLE deductions 
      ADD COLUMN IF NOT EXISTS excluded_grades jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS excluded_employment_types jsonb DEFAULT '[]'::jsonb;
    `);

    // Add columns to allowances
    console.log('Adding columns to allowances...');
    await client.query(`
      ALTER TABLE allowances 
      ADD COLUMN IF NOT EXISTS excluded_grades jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS excluded_employment_types jsonb DEFAULT '[]'::jsonb;
    `);
    
    // Add columns to staff_deductions (if needed, but usually these are applied globally, we will see)
    // Actually, exclusions usually apply to the global definition, but just in case, let's keep it to deductions and allowances.

    // Seed existing hardcoded logic for Union Dues
    // Hardcoded logic: 
    // - Union Dues excluded for Cat 1, Cat 4, and "Senior Grades" (excludeUnionForSeniorGrades = ['GL 17', 'GL 16', 'GL 15', 'GL 14', 'GL 13', 'GL 12'])
    // - Pension, NHF, NHIS, Union Dues excluded for 'Contract'
    // - Pension, NHF, NHIS, Union Dues excluded for Cat 1.
    // - NHF, NHIS, Union Dues excluded for Cat 4.

    console.log('Seeding existing exclusions into deductions...');

    // 1. Pension
    await client.query(`
      UPDATE deductions 
      SET excluded_grades = '["CAT1", "CAT 1"]'::jsonb,
          excluded_employment_types = '["Contract"]'::jsonb
      WHERE code ILIKE '%PENSION%' OR name ILIKE '%PENSION%';
    `);

    // 2. NHF
    await client.query(`
      UPDATE deductions 
      SET excluded_grades = '["CAT1", "CAT 1", "CAT4", "CAT 4"]'::jsonb,
          excluded_employment_types = '["Contract"]'::jsonb
      WHERE code ILIKE '%NHF%' OR name ILIKE '%NHF%' OR name ILIKE '%HOUSING FUND%';
    `);

    // 3. NHIS
    await client.query(`
      UPDATE deductions 
      SET excluded_grades = '["CAT1", "CAT 1", "CAT4", "CAT 4"]'::jsonb,
          excluded_employment_types = '["Contract"]'::jsonb
      WHERE code ILIKE '%NHIS%' OR name ILIKE '%NHIS%' OR name ILIKE '%HEALTH INSURANCE%' OR code ILIKE '%NHIA%';
    `);

    // 4. Union Dues
    await client.query(`
      UPDATE deductions 
      SET excluded_grades = '["CAT1", "CAT 1", "CAT4", "CAT 4", "12", "13", "14", "15", "16", "17", "012", "013", "014", "015", "016", "017", "GL 12", "GL 13", "GL 14", "GL 15", "GL 16", "GL 17"]'::jsonb,
          excluded_employment_types = '["Contract"]'::jsonb
      WHERE code ILIKE '%UNION%' OR name ILIKE '%UNION%';
    `);

    await client.query('COMMIT');
    console.log('Migration successful!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
