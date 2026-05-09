
const { Client } = require('pg');
require('dotenv').config();

async function backfill() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Get all payroll lines without bank details
    const res = await client.query(`
      SELECT pl.id, pl.staff_id 
      FROM payroll_lines pl
      WHERE pl.bank_name IS NULL OR pl.account_number IS NULL
    `);

    console.log(`Found ${res.rowCount} payroll lines to update`);

    for (const line of res.rows) {
      // Get staff bank details
      const staffRes = await client.query(`
        SELECT bank_name, account_number 
        FROM staff 
        WHERE id = $1
      `, [line.staff_id]);

      if (staffRes.rowCount > 0) {
        const { bank_name, account_number } = staffRes.rows[0];
        
        if (bank_name || account_number) {
          await client.query(`
            UPDATE payroll_lines 
            SET bank_name = $1, account_number = $2 
            WHERE id = $3
          `, [bank_name, account_number, line.id]);
          console.log(`Updated line ${line.id} for staff ${line.staff_id}`);
        }
      }
    }

    console.log('Backfill completed');
  } catch (err) {
    console.error('Error executing backfill', err);
  } finally {
    await client.end();
  }
}

backfill();
