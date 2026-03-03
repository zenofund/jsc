const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_bosPx5R4VXKZ@ep-tiny-credit-ajix0564.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

(async () => {
  try {
    await client.connect();
    
console.log('\n--- LATEST PAYROLL BATCH ---');
const batch = await client.query("SELECT id, batch_number, status, total_staff, current_approval_stage FROM payroll_batches ORDER BY created_at DESC LIMIT 3");
console.log(JSON.stringify(batch.rows, null, 2));

    await client.end();
  } catch(e) {
    console.error(e);
  }
})();
