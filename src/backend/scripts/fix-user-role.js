
const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function checkUserConstraints() {
  try {
    await client.connect();
    console.log('Connected to database');

    // 1. Check if user_role enum exists
    const enumRes = await client.query(`
      SELECT t.typname, e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role';
    `);

    if (enumRes.rows.length > 0) {
      console.log('Found user_role ENUM with values:', enumRes.rows.map(r => r.enumlabel));
      
      const hasLoader = enumRes.rows.some(r => r.enumlabel === 'payroll_loader');
      if (!hasLoader) {
        console.log('Adding payroll_loader to user_role ENUM...');
        await client.query("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'payroll_loader'");
        console.log('✅ Added payroll_loader to user_role ENUM');
      } else {
        console.log('✅ payroll_loader already exists in user_role ENUM');
      }
    } else {
      console.log('No user_role ENUM found. Checking constraints on users table...');
      
      const constraintRes = await client.query(`
        SELECT conname, pg_get_constraintdef(c.oid)
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public' AND conrelid = 'users'::regclass;
      `);
      
      console.log('Constraints on users table:');
      let roleConstraintFound = false;
      
      for (const row of constraintRes.rows) {
        console.log(`${row.conname}: ${row.pg_get_constraintdef}`);
        if (row.pg_get_constraintdef.includes('role')) {
             roleConstraintFound = true;
             if (!row.pg_get_constraintdef.includes('payroll_loader')) {
                 console.log('⚠️ Role constraint found but missing payroll_loader. You may need to drop and recreate this constraint.');
                 // Try to alter constraint if possible or warn user
                 console.log('Attempting to update check constraint...');
                 
                 // Extract existing roles and add new one
                 // This is complex to parse safely with regex, safer to drop and add
                 try {
                     await client.query(`ALTER TABLE users DROP CONSTRAINT "${row.conname}"`);
                     // Reconstruct with new role
                     const match = row.pg_get_constraintdef.match(/ARRAY\[(.*?)\]/);
                     if (match) {
                         let roles = match[1];
                         if (!roles.includes("'payroll_loader'")) {
                             roles += ", 'payroll_loader'::character varying";
                         }
                         await client.query(`ALTER TABLE users ADD CONSTRAINT "${row.conname}" CHECK (((role)::text = ANY (ARRAY[${roles}]::text[])))`);
                         console.log('✅ Successfully updated role constraint');
                     }
                 } catch (e) {
                     console.error('Failed to update constraint automatically:', e.message);
                 }
             } else {
                 console.log('✅ payroll_loader already allowed in role constraint');
             }
        }
      }
      
      if (!roleConstraintFound) {
          console.log('ℹ️ No explicit role check constraint found on users table. It might be free text or handled in app layer.');
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkUserConstraints();
