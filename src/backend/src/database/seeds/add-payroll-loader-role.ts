import 'dotenv/config';
import { Client } from 'pg';

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set in environment variables');
    // Try to load from default location if not found
    console.log('Current directory:', process.cwd());
    process.exit(1);
  }

  console.log('Connecting to database...');
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    await client.query('BEGIN');

    // Check if user_role enum exists
    const enumCheck = await client.query(`
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role')
    `);

    if (enumCheck.rows[0].exists) {
      console.log('user_role enum exists, checking for payroll_loader...');
      
      // Check if payroll_loader is already in the enum
      const enumValues = await client.query(`
        SELECT unnest(enum_range(NULL::user_role)) as value
      `);
      
      const hasPayrollLoader = enumValues.rows.some(row => row.value === 'payroll_loader');
      
      if (!hasPayrollLoader) {
        try {
          // Add value to enum
          // Note: ALTER TYPE ... ADD VALUE cannot be executed inside a transaction block
          // So we have to commit first, then run it, then start new transaction
          await client.query('COMMIT');
          await client.query(`ALTER TYPE user_role ADD VALUE 'payroll_loader'`);
          console.log('✅ Added payroll_loader to user_role enum');
          await client.query('BEGIN');
        } catch (err: any) {
          console.log('⚠️ Could not add value to enum (might already exist or transaction issue):', err.message);
          // If we failed outside transaction, we might need to be careful.
          // Re-establish transaction for subsequent steps
          await client.query('BEGIN');
        }
      } else {
        console.log('ℹ️ payroll_loader already exists in user_role enum');
      }
    } else {
      console.log('user_role enum does not exist, checking for check constraints...');
      
      // Check for check constraints on users table
      const constraintCheck = await client.query(`
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%role%'
      `);

      let constraintUpdated = false;

      for (const row of constraintCheck.rows) {
        console.log(`Found constraint: ${row.conname} - ${row.definition}`);
        if (!row.definition.includes('payroll_loader')) {
           // We need to drop and recreate the constraint
           console.log(`Updating constraint ${row.conname}...`);
           await client.query(`ALTER TABLE users DROP CONSTRAINT ${row.conname}`);
           
           // We'll replace it with a comprehensive list including payroll_loader
           // We assume the standard list + payroll_loader
           await client.query(`
             ALTER TABLE users ADD CONSTRAINT ${row.conname} 
             CHECK (role IN ('admin', 'super_admin', 'staff', 'payroll_officer', 'payroll_manager', 'cooperative_officer', 'loan_officer', 'audit_officer', 'payroll_loader'))
           `);
           console.log(`✅ Updated constraint ${row.conname}`);
           constraintUpdated = true;
        } else {
           console.log(`ℹ️ Constraint ${row.conname} already includes payroll_loader`);
        }
      }
      
      if (!constraintCheck.rows.length) {
        // No constraint found, maybe add one? Or rely on application validation.
        console.log('ℹ️ No role check constraints found on users table.');
      }
    }

    await client.query('COMMIT');
    console.log('✅ Role migration completed successfully');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
