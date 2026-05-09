
const { Client } = require('pg');
require('dotenv').config();

async function checkData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    console.log('\n--- Latest Failed Idempotency Key ---');
    const keys = await client.query('SELECT key, path, status, created_at, response_code, response_body FROM idempotency_keys WHERE status = \'FAILED\' ORDER BY created_at DESC LIMIT 1');
    console.log(JSON.stringify(keys.rows, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkData();
