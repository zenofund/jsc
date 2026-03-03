
require('dotenv').config();
const { Client } = require('pg');
async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    const res = await client.query('SELECT id, email, role FROM users LIMIT 5');
    console.log(JSON.stringify(res.rows, null, 2));
    const staffRes = await client.query('SELECT id, staff_number FROM staff LIMIT 5');
    console.log(JSON.stringify(staffRes.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
main();
