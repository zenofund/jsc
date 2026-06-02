const { Client } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// Load backend .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB. Running missing bank query...');

    const q = `
      SELECT id, staff_number, COALESCE(NULLIF(TRIM(bank_name), ''), '') AS bank_name, COALESCE(NULLIF(TRIM(account_number), ''), '') AS account_number
      FROM staff
      WHERE COALESCE(NULLIF(TRIM(bank_name), ''), '') = '' OR COALESCE(NULLIF(TRIM(account_number), ''), '') = ''
      LIMIT 200;
    `;

    const res = await client.query(q);
    console.log(`Found ${res.rowCount} staff records with missing bank_name or account_number (showing up to 200 rows).`);
    if (res.rowCount > 0) {
      console.table(res.rows);
    }

    await client.end();
  } catch (err) {
    console.error('Error querying DB:', err.message || err);
    process.exit(1);
  }
}

run();
