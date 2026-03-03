const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkData() {
  try {
    await client.connect();
    
    console.log('--- Recent Promotions ---');
    const promos = await client.query('SELECT id, staff_id, promotion_date, created_at FROM promotions ORDER BY created_at DESC LIMIT 5');
    console.table(promos.rows);

    console.log('\n--- Recent Arrears ---');
    const arrears = await client.query('SELECT id, staff_id, effective_date, created_at, details FROM arrears ORDER BY created_at DESC LIMIT 5');
    console.table(arrears.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkData();
