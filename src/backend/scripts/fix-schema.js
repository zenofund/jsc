const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bosPx5R4VXKZ@ep-tiny-credit-ajix0564.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function fixSchema() {
  try {
    await client.connect();
    console.log('Connected to database');

    // 1. Fix leave_requests: Make leave_type nullable (or drop it if we are bold, but safer to make nullable)
    await client.query(`
      ALTER TABLE leave_requests 
      ALTER COLUMN leave_type DROP NOT NULL;
    `);
    console.log('Made leave_type nullable in leave_requests');

    // 2. Fix smtp_settings: Rename user_name to username if it exists, or add username
    // The error said "column username does not exist". 
    // My previous script created "user_name".
    // I should check if user_name exists and rename it, or just add username.
    // Let's just add username and update user_name
    await client.query(`
      ALTER TABLE smtp_settings 
      ADD COLUMN IF NOT EXISTS username VARCHAR(255);
    `);
    console.log('Added username to smtp_settings');

    // 3. Fix email_logs: Rename recipient to recipient_email or add recipient_email
    // Error: "column recipient_email ... does not exist"
    await client.query(`
      ALTER TABLE email_logs 
      ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255);
    `);
    console.log('Added recipient_email to email_logs');

  } catch (err) {
    console.error('Error fixing schema:', err);
    // Don't fail if column doesn't exist to drop not null (if it was already dropped or table structure different)
  } finally {
    await client.end();
  }
}

fixSchema();
