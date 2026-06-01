
const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_bosPx5R4VXKZ@ep-tiny-credit-ajix0564.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function fixStuckBatches() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Find all batches in 'pending_review' status
    const pendingBatches = await client.query(`
      SELECT id, batch_number, current_approval_stage 
      FROM payroll_batches 
      WHERE status = 'pending_review'
    `);

    console.log(`Found ${pendingBatches.rowCount} pending batches`);

    for (const batch of pendingBatches.rows) {
      console.log(`Checking batch ${batch.batch_number} (ID: ${batch.id})...`);
      
      // Check if current stage is already approved
      const currentApproval = await client.query(`
        SELECT * FROM workflow_approvals 
        WHERE payroll_batch_id = $1 AND stage = $2 AND status = 'approved'
      `, [batch.id, batch.current_approval_stage]);

      if (currentApproval.rowCount > 0) {
        console.log(`  Stage ${batch.current_approval_stage} is already APPROVED.`);
        
        // Check if there is a next stage
        const nextStage = await client.query(`
          SELECT * FROM workflow_approvals 
          WHERE payroll_batch_id = $1 AND stage > $2 
          ORDER BY stage ASC LIMIT 1
        `, [batch.id, batch.current_approval_stage]);

        if (nextStage.rowCount === 0) {
          console.log(`  No next stage found. This batch should be READY FOR PAYMENT.`);
          
          // Fix it
          await client.query(`
            UPDATE payroll_batches 
            SET status = 'ready_for_payment', updated_at = NOW() 
            WHERE id = $1
          `, [batch.id]);
          
          console.log(`  ✅ Batch ${batch.batch_number} updated to 'ready_for_payment'`);
        } else {
          console.log(`  Next stage found: Stage ${nextStage.rows[0].stage}. Moving to next stage...`);
          
          // Move to next stage
          await client.query(`
            UPDATE payroll_batches 
            SET current_approval_stage = $2, updated_at = NOW() 
            WHERE id = $1
          `, [batch.id, nextStage.rows[0].stage]);
          
          console.log(`  ✅ Batch ${batch.batch_number} moved to stage ${nextStage.rows[0].stage}`);
        }
      } else {
        console.log(`  Stage ${batch.current_approval_stage} is NOT approved yet. Leaving as is.`);
      }
    }

  } catch (err) {
    console.error('Error executing script:', err);
  } finally {
    await client.end();
    console.log('Disconnected');
  }
}

fixStuckBatches();
