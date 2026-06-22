const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const backupRunId = process.argv[2];

if (!backupRunId) {
  console.error('Usage: node scripts/rollback-loan-start-month-shift.js <backup_run_id>');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function main() {
  try {
    await client.connect();
    await client.query('BEGIN');

    const backupResult = await client.query(
      `
        SELECT
          disbursement_id,
          disbursement_number,
          old_start_month,
          old_end_month
        FROM loan_disbursement_schedule_backups
        WHERE backup_run_id = $1
        ORDER BY disbursement_number;
      `,
      [backupRunId],
    );

    if (backupResult.rows.length === 0) {
      await client.query('ROLLBACK');
      console.error(`No backup rows found for backup_run_id=${backupRunId}`);
      process.exit(1);
    }

    for (const row of backupResult.rows) {
      await client.query(
        `
          UPDATE loan_disbursements
          SET
            start_month = $2,
            end_month = $3,
            updated_at = NOW()
          WHERE id = $1;
        `,
        [row.disbursement_id, row.old_start_month, row.old_end_month],
      );
    }

    await client.query('COMMIT');

    console.log(`Rollback completed successfully for backup_run_id=${backupRunId}`);
    console.log(`Rows restored: ${backupResult.rows.length}`);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback transaction failed:', rollbackError);
    }
    console.error('Rollback execution failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
