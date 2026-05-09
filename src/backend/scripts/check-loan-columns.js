
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function checkColumns() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'loan_applications';
    `);
    console.log('Columns in loan_applications:');
    res.rows.forEach(row => console.log(`${row.column_name} (${row.data_type})`));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkColumns();
