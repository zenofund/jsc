const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function checkConstraints() {
  try {
    await client.connect();
    console.log('Connected to database');

    const res = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND conrelid = 'staff'::regclass;
    `);

    console.log('Constraints on staff table:');
    res.rows.forEach(row => {
      console.log(`${row.conname}: ${row.pg_get_constraintdef}`);
    });

  } catch (err) {
    console.error('Error querying constraints:', err);
  } finally {
    await client.end();
  }
}

checkConstraints();
