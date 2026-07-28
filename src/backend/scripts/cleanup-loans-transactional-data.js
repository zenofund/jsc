const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function parseArgs(argv) {
  const args = {
    execute: false,
    confirm: '',
    backupDir: '',
    allowPayrollReferences: false,
  };

  for (const arg of argv) {
    if (arg === '--execute') {
      args.execute = true;
      continue;
    }
    if (arg === '--allow-payroll-references') {
      args.allowPayrollReferences = true;
      continue;
    }
    if (arg.startsWith('--confirm=')) {
      args.confirm = arg.split('=').slice(1).join('=').trim();
      continue;
    }
    if (arg.startsWith('--backup-dir=')) {
      args.backupDir = arg.split('=').slice(1).join('=').trim();
    }
  }

  return args;
}

function nowStamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
    now.getMinutes(),
  )}${pad(now.getSeconds())}`;
}

async function getCount(client, table) {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
  return Number(result.rows[0]?.count || 0);
}

async function getPayrollLoanReferenceCount(client) {
  const result = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM payroll_lines
      WHERE deductions::text ILIKE '%loan_disbursement_id%'
         OR deductions::text ILIKE '%"code":"LOAN"%'
         OR deductions::text ILIKE '%"code": "LOAN"%'
    `,
  );
  return Number(result.rows[0]?.count || 0);
}

async function exportTable(client, table, outDir) {
  const rows = await client.query(`SELECT * FROM ${table} ORDER BY created_at ASC NULLS LAST`);
  const outputPath = path.join(outDir, `${table}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(rows.rows, null, 2), 'utf8');
  return { table, rows: rows.rows.length, outputPath };
}

async function deleteAll(client) {
  const deleted = {};

  deleted.loan_repayments = await client.query('DELETE FROM loan_repayments');
  deleted.loan_guarantors = await client.query('DELETE FROM loan_guarantors');
  deleted.loan_disbursements = await client.query('DELETE FROM loan_disbursements');
  deleted.loan_applications = await client.query('DELETE FROM loan_applications');

  return {
    loan_repayments: Number(deleted.loan_repayments.rowCount || 0),
    loan_guarantors: Number(deleted.loan_guarantors.rowCount || 0),
    loan_disbursements: Number(deleted.loan_disbursements.rowCount || 0),
    loan_applications: Number(deleted.loan_applications.rowCount || 0),
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const execute = args.execute === true;
  const modeLabel = execute ? 'EXECUTE' : 'DRY RUN';

  if (execute && args.confirm !== 'DELETE_LOANS') {
    console.error('Refusing to execute. Provide --confirm=DELETE_LOANS to proceed.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log(`[${modeLabel}] Connected to database`);

    const preCounts = {
      loan_types: await getCount(client, 'loan_types'),
      loan_applications: await getCount(client, 'loan_applications'),
      loan_disbursements: await getCount(client, 'loan_disbursements'),
      loan_guarantors: await getCount(client, 'loan_guarantors'),
      loan_repayments: await getCount(client, 'loan_repayments'),
    };

    const payrollLoanRefs = await getPayrollLoanReferenceCount(client);

    console.log(`[${modeLabel}] Pre-counts:`, JSON.stringify(preCounts, null, 2));
    console.log(`[${modeLabel}] Payroll lines with loan references: ${payrollLoanRefs}`);

    if (!args.allowPayrollReferences && payrollLoanRefs > 0) {
      console.error(
        `Refusing to proceed: found ${payrollLoanRefs} payroll line(s) containing loan references in deductions snapshots. Re-run with --allow-payroll-references only if you accept orphaned snapshot IDs.`,
      );
      process.exit(1);
    }

    const backupRoot =
      args.backupDir && args.backupDir.trim()
        ? path.resolve(args.backupDir.trim())
        : path.resolve(__dirname, '..', 'backups', `loan-cleanup-${nowStamp()}`);

    fs.mkdirSync(backupRoot, { recursive: true });

    const backupMeta = {
      mode: modeLabel,
      created_at: new Date().toISOString(),
      payroll_loan_reference_lines: payrollLoanRefs,
      pre_counts: preCounts,
      tables: [],
    };

    for (const table of ['loan_repayments', 'loan_guarantors', 'loan_disbursements', 'loan_applications']) {
      const exported = await exportTable(client, table, backupRoot);
      backupMeta.tables.push(exported);
    }

    fs.writeFileSync(path.join(backupRoot, `meta.json`), JSON.stringify(backupMeta, null, 2), 'utf8');
    console.log(`[${modeLabel}] Backup written to: ${backupRoot}`);

    if (!execute) {
      console.log(`[${modeLabel}] No deletions performed.`);
      return;
    }

    await client.query('BEGIN');
    const deleted = await deleteAll(client);
    await client.query('COMMIT');

    const postCounts = {
      loan_types: await getCount(client, 'loan_types'),
      loan_applications: await getCount(client, 'loan_applications'),
      loan_disbursements: await getCount(client, 'loan_disbursements'),
      loan_guarantors: await getCount(client, 'loan_guarantors'),
      loan_repayments: await getCount(client, 'loan_repayments'),
    };

    console.log(`[${modeLabel}] Deleted rows:`, JSON.stringify(deleted, null, 2));
    console.log(`[${modeLabel}] Post-counts:`, JSON.stringify(postCounts, null, 2));
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {}
    console.error(`[${modeLabel}] Loan cleanup failed:`, error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

