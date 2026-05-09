import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to database');

    console.log('\n--- DEDUCTIONS COLUMNS ---');
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'deductions';
    `);
    console.table(res.rows);

    console.log('\n--- DEDUCTIONS DATA ---');
    const data = await client.query('SELECT * FROM deductions');
    console.log(JSON.stringify(data.rows, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
