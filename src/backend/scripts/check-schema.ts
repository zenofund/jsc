import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

async function checkDatabaseSchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    
    console.log('--- Tables ---');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(tables.rows.map(r => r.table_name).join(', '));

    console.log('\n--- Columns in loan_applications ---');
    const loanAppColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'loan_applications'
    `);
    console.log(loanAppColumns.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    console.log('\n--- Columns in loan_types ---');
    const loanTypeColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'loan_types'
    `);
    console.log(loanTypeColumns.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    console.log('\n--- Checking cooperatives table ---');
    const coopTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'cooperatives'
      );
    `);
    console.log('Cooperatives table exists:', coopTable.rows[0].exists);

    client.release();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkDatabaseSchema();
