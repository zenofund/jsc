import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

async function checkQueries() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    
    console.log('--- Testing findAllLoanApplications Query ---');
    try {
      const query = `
        SELECT la.*, lt.name as loan_type_name, lt.cooperative_id,
          COUNT(lg.id) as guarantor_count
        FROM loan_applications la
        LEFT JOIN loan_types lt ON la.loan_type_id = lt.id
        LEFT JOIN loan_guarantors lg ON la.id = lg.loan_application_id
        GROUP BY la.id, lt.name, lt.cooperative_id 
        ORDER BY la.created_at DESC
      `;
      await client.query(query);
      console.log('✅ findAllLoanApplications Query is VALID');
    } catch (err) {
      console.error('❌ findAllLoanApplications Query FAILED:', err.message);
    }

    console.log('\n--- Testing findAllDisbursements Query ---');
    try {
      const query = `
        SELECT ld.*, la.application_number, la.loan_type_name
        FROM loan_disbursements ld
        LEFT JOIN loan_applications la ON ld.loan_application_id = la.id
      `;
      await client.query(query);
      console.log('✅ findAllDisbursements Query is VALID');
    } catch (err) {
      console.error('❌ findAllDisbursements Query FAILED:', err.message);
    }

    client.release();
  } catch (err) {
    console.error('Connection Error:', err);
  } finally {
    await pool.end();
  }
}

checkQueries();
