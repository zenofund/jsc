
import { Client } from 'pg';

const dbUrl = 'postgresql://neondb_owner:npg_bosPx5R4VXKZ@ep-tiny-credit-ajix0564.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function checkDeductions() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Get the latest payroll line
    const res = await client.query(`
      SELECT id, staff_name, deductions, total_deductions, created_at
      FROM payroll_lines
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (res.rows.length === 0) {
      console.log('No payroll lines found');
    } else {
      const line = res.rows[0];
      console.log('Latest Payroll Line:');
      console.log('Staff Name:', line.staff_name);
      console.log('Total Deductions (DB Column):', line.total_deductions);
      console.log('Deductions JSON (Raw):', line.deductions);
      
      try {
        const parsed = JSON.parse(line.deductions);
        console.log('Deductions JSON (Parsed):', JSON.stringify(parsed, null, 2));
        console.log('Is Array?', Array.isArray(parsed));
        console.log('Length:', parsed.length);
      } catch (e) {
        console.error('Failed to parse JSON:', e.message);
      }
    }

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await client.end();
  }
}

checkDeductions();
