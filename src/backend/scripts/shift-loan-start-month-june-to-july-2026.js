const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SOURCE_MONTH = '2026-06';
const TARGET_MONTH = '2026-07';
const CHANGE_REASON =
  'Shift June 2026 loan schedules to July 2026 to avoid double deduction after off-app June processing';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

function calculateEndMonth(startMonth, tenureMonths) {
  if (!startMonth || !/^\d{4}-\d{2}$/.test(startMonth) || !Number.isFinite(tenureMonths) || tenureMonths < 1) {
    return null;
  }

  const [year, month] = startMonth.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + tenureMonths - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function ensureBackupTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS loan_disbursement_schedule_backups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      backup_run_id TEXT NOT NULL,
      change_reason TEXT NOT NULL,
      disbursement_id UUID NOT NULL,
      disbursement_number VARCHAR(50),
      old_start_month VARCHAR(7),
      old_end_month VARCHAR(7),
      old_updated_at TIMESTAMPTZ,
      tenure_months INTEGER,
      status VARCHAR(20),
      had_repayments BOOLEAN NOT NULL DEFAULT FALSE,
      row_data JSONB NOT NULL,
      backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function fetchEligibleRows() {
  const result = await client.query(
    `
      SELECT
        ld.*,
        EXISTS (
          SELECT 1
          FROM loan_repayments lr
          WHERE lr.disbursement_id = ld.id
        ) AS had_repayments
      FROM loan_disbursements ld
      WHERE ld.status = 'active'
        AND ld.start_month = $1
        AND NOT EXISTS (
          SELECT 1
          FROM loan_repayments lr
          WHERE lr.disbursement_id = ld.id
        )
      ORDER BY ld.disbursement_number;
    `,
    [SOURCE_MONTH],
  );

  return result.rows;
}

async function backupRows(backupRunId, rows) {
  for (const row of rows) {
    await client.query(
      `
        INSERT INTO loan_disbursement_schedule_backups (
          backup_run_id,
          change_reason,
          disbursement_id,
          disbursement_number,
          old_start_month,
          old_end_month,
          old_updated_at,
          tenure_months,
          status,
          had_repayments,
          row_data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb);
      `,
      [
        backupRunId,
        CHANGE_REASON,
        row.id,
        row.disbursement_number,
        row.start_month,
        row.end_month,
        row.updated_at,
        row.tenure_months,
        row.status,
        Boolean(row.had_repayments),
        JSON.stringify(row),
      ],
    );
  }
}

async function updateRows(rows) {
  const updated = [];

  for (const row of rows) {
    const nextEndMonth = calculateEndMonth(TARGET_MONTH, Number(row.tenure_months));

    const result = await client.query(
      `
        UPDATE loan_disbursements
        SET
          start_month = $2,
          end_month = $3,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, disbursement_number, staff_number, start_month, end_month, tenure_months, status;
      `,
      [row.id, TARGET_MONTH, nextEndMonth],
    );

    updated.push(result.rows[0]);
  }

  return updated;
}

async function main() {
  const backupRunId = `loan-start-shift-${SOURCE_MONTH}-to-${TARGET_MONTH}-${Date.now()}`;

  try {
    await client.connect();
    await client.query('BEGIN');

    await ensureBackupTable();

    const eligibleRows = await fetchEligibleRows();
    console.log(`Eligible active disbursements with start_month=${SOURCE_MONTH} and no repayments: ${eligibleRows.length}`);

    if (eligibleRows.length === 0) {
      await client.query('ROLLBACK');
      console.log('No eligible rows found. No changes applied.');
      return;
    }

    console.log('Preview of affected disbursements:');
    eligibleRows.slice(0, 20).forEach((row) => {
      console.log(
        `${row.disbursement_number} | ${row.staff_number || 'N/A'} | ${row.start_month} -> ${TARGET_MONTH} | tenure=${row.tenure_months} | end=${row.end_month || 'null'}`,
      );
    });
    if (eligibleRows.length > 20) {
      console.log(`...and ${eligibleRows.length - 20} more row(s).`);
    }

    await backupRows(backupRunId, eligibleRows);
    const updatedRows = await updateRows(eligibleRows);

    await client.query('COMMIT');

    console.log('\nUpdate completed successfully.');
    console.log(`Backup run ID: ${backupRunId}`);
    console.log(`Rows updated: ${updatedRows.length}`);
    console.log('Sample updated rows:');
    updatedRows.slice(0, 20).forEach((row) => {
      console.log(
        `${row.disbursement_number} | ${row.staff_number || 'N/A'} | start=${row.start_month} | end=${row.end_month || 'null'} | tenure=${row.tenure_months}`,
      );
    });

    console.log('\nRollback command if needed:');
    console.log(`node scripts/rollback-loan-start-month-shift.js ${backupRunId}`);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    console.error('Update failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
