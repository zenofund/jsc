
require('dotenv').config({ path: './.env' });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkStaffSchema() {
  try {
    await client.connect();
    console.log('Connected to database');

    const tables = ['staff_allowances', 'staff_deductions'];

    for (const table of tables) {
        console.log(`\nChecking table: ${table}`);
        const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${table}';
        `);

        console.log(`Columns in ${table}:`);
        res.rows.forEach(row => {
        console.log(`- ${row.column_name} (${row.data_type})`);
        });
        
        const hasStartMonth = res.rows.some(r => r.column_name === 'start_month');
        if (!hasStartMonth) {
            console.log(`MISSING 'start_month' in ${table}`);
        }
        
        const hasEndMonth = res.rows.some(r => r.column_name === 'end_month');
        if (!hasEndMonth) {
            console.log(`MISSING 'end_month' in ${table}`);
        }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkStaffSchema();
