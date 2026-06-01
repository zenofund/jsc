
require('dotenv').config({ path: './.env' });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkAndFix() {
  try {
    await client.connect();
    console.log('Connected to database');

    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'payroll_batches';
    `);

    console.log('Columns in payroll_batches:');
    res.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type})`);
    });

    const hasMonth = res.rows.some(r => r.column_name === 'month');
    const hasPayrollMonth = res.rows.some(r => r.column_name === 'payroll_month');

    if (hasMonth && !hasPayrollMonth) {
      console.log('Found "month" column but missing "payroll_month". Renaming...');
      await client.query('ALTER TABLE payroll_batches RENAME COLUMN month TO payroll_month;');
      console.log('Successfully renamed column "month" to "payroll_month".');
    } else if (hasPayrollMonth) {
      console.log('"payroll_month" column already exists.');
    } else {
      console.log('Neither "month" nor "payroll_month" column found. Schema might be very different.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkAndFix();
