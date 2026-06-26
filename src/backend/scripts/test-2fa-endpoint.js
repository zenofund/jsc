const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // pick an active user
    const user = (await client.query("SELECT id, email FROM users WHERE status='active' LIMIT 1")).rows[0];
    if (!user) {
      console.error('No active user found');
      return;
    }

    const testPassword = 'Password123!';
    const hash = await bcrypt.hash(testPassword, 10);

    await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, user.id]);
    console.log('✅ Updated password for', user.email);

    // call the endpoint
    const url = 'http://localhost:3000/api/v1/auth/2fa/setup';
    const body = { email: user.email, password: testPassword };

    console.log('➡️  POST', url, 'with', body);

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    console.log('Response status:', resp.status);
    console.log('Response body:', text);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

main();
