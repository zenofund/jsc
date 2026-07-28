const { Client } = require('pg');
require('dotenv').config();

function parseArgs(argv) {
  const args = {
    execute: false,
    batchId: '',
  };

  for (const arg of argv) {
    if (arg === '--execute') {
      args.execute = true;
      continue;
    }
    if (arg.startsWith('--batch-id=')) {
      args.batchId = arg.split('=').slice(1).join('=').trim();
    }
  }

  return args;
}

function roundCurrency(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return [];
}

async function ensureRepaymentConstraint(client) {
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_repayments_disbursement_month_unique
    ON loan_repayments(disbursement_id, month)
    WHERE month IS NOT NULL
  `);
}

async function getCandidateBatches(client, batchId) {
  const params = [];
  let whereClause = `WHERE status IN ('locked', 'paid')`;

  if (batchId) {
    params.push(batchId);
    whereClause += ` AND id = $${params.length}`;
  }

  const result = await client.query(
    `SELECT id, batch_number, payroll_month, status
     FROM payroll_batches
     ${whereClause}
     ORDER BY payroll_month ASC, created_at ASC`,
    params,
  );

  return result.rows;
}

async function getLoanDeductionsForBatch(client, batchId) {
  const result = await client.query(
    `
      SELECT
        pb.id AS payroll_batch_id,
        pb.batch_number,
        pb.payroll_month,
        pl.staff_id,
        pl.staff_number,
        pl.staff_name,
        d.item->>'loan_disbursement_id' AS disbursement_id,
        COALESCE((d.item->>'amount')::numeric, 0)::numeric AS total_amount,
        COALESCE((d.item->>'loan_monthly_installment')::numeric, (d.item->>'amount')::numeric, 0)::numeric AS monthly_amount,
        ARRAY(
          SELECT jsonb_array_elements_text(COALESCE(d.item->'loan_months', '[]'::jsonb))
        ) AS loan_months
      FROM payroll_batches pb
      JOIN payroll_lines pl ON pl.payroll_batch_id = pb.id
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(pl.deductions::jsonb) = 'array' THEN pl.deductions::jsonb
          ELSE '[]'::jsonb
        END
      ) AS d(item)
      WHERE pb.id = $1
        AND d.item->>'code' = 'LOAN'
      ORDER BY pl.staff_number ASC, pl.staff_name ASC
    `,
    [batchId],
  );

  return result.rows;
}

async function loadDisbursementState(client, cache, disbursementId, staffId) {
  const cacheKey = `${disbursementId}:${staffId}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const result = await client.query(
    `
      SELECT id, staff_id, disbursement_number, tenure_months, balance_outstanding, status
      FROM loan_disbursements
      WHERE id = $1 AND staff_id = $2
    `,
    [disbursementId, staffId],
  );

  if (!result.rows[0]) {
    cache.set(cacheKey, null);
    return null;
  }

  const disbursement = {
    id: result.rows[0].id,
    staffId: result.rows[0].staff_id,
    disbursementNumber: result.rows[0].disbursement_number,
    tenureMonths: Number(result.rows[0].tenure_months || 1),
    outstanding: roundCurrency(result.rows[0].balance_outstanding || 0),
    status: result.rows[0].status,
    dirty: false,
  };
  cache.set(cacheKey, disbursement);
  return disbursement;
}

async function getExistingRepayment(client, disbursementId, repaymentMonth) {
  const result = await client.query(
    `
      SELECT id
      FROM loan_repayments
      WHERE disbursement_id = $1 AND month = $2
      LIMIT 1
    `,
    [disbursementId, repaymentMonth],
  );
  return result.rows[0] || null;
}

async function updateDisbursementBalances(client, disbursement) {
  const paidMonthsResult = await client.query(
    `
      SELECT COUNT(DISTINCT month)::int AS count
      FROM loan_repayments
      WHERE disbursement_id = $1
    `,
    [disbursement.id],
  );

  const paidMonths = Number(paidMonthsResult.rows[0]?.count || 0);
  const remainingTenor = Math.max(1, Number(disbursement.tenureMonths || 1) - paidMonths);
  const calculatedDeduction = Math.round(roundCurrency(disbursement.outstanding) / remainingTenor);
  const newMonthlyDeduction = Number.isNaN(calculatedDeduction) ? 0 : calculatedDeduction;

  await client.query(
    `
      UPDATE loan_disbursements
      SET balance_outstanding = $1::decimal,
          monthly_deduction = CASE WHEN $1::decimal > 0 THEN $2::decimal ELSE monthly_deduction END,
          status = CASE WHEN $1::decimal <= 0 THEN 'completed' ELSE status END,
          updated_at = NOW()
      WHERE id = $3
    `,
    [roundCurrency(disbursement.outstanding), newMonthlyDeduction, disbursement.id],
  );
}

async function processDeductionEntry(client, batch, deduction, execute, dryRunCache) {
  const result = {
    inserted: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const months = toArray(deduction.loan_months);
  const repaymentMonths = months.length > 0 ? months : [batch.payroll_month];
  const disbursementId = String(deduction.disbursement_id || '').trim();

  if (!disbursementId) {
    result.failed += 1;
    result.errors.push({
      staffName: deduction.staff_name,
      staffNumber: deduction.staff_number,
      error: 'Missing loan_disbursement_id in payroll line deduction snapshot.',
    });
    return result;
  }

  const entryClient = execute ? client : null;
  const disbursementState = execute
    ? await loadDisbursementState(client, new Map(), disbursementId, deduction.staff_id)
    : await loadDisbursementState(client, dryRunCache, disbursementId, deduction.staff_id);

  if (!disbursementState) {
    result.failed += 1;
    result.errors.push({
      staffName: deduction.staff_name,
      staffNumber: deduction.staff_number,
      error: `Loan disbursement ${disbursementId} was not found for the staff member.`,
    });
    return result;
  }

  let remainingAmount = Math.min(
    roundCurrency(deduction.total_amount || 0),
    roundCurrency(disbursementState.outstanding),
  );
  const monthlyAmount = Math.max(0, roundCurrency(deduction.monthly_amount || deduction.total_amount || 0));
  let insertedForEntry = 0;
  let skippedForEntry = 0;

  for (const repaymentMonth of repaymentMonths) {
    if (disbursementState.outstanding <= 0 || remainingAmount <= 0) {
      break;
    }

    const existingRepayment = await getExistingRepayment(client, disbursementState.id, repaymentMonth);
    if (existingRepayment) {
      skippedForEntry += 1;
      result.skipped += 1;
      continue;
    }

    const installmentAmount = Math.min(
      monthlyAmount > 0 ? monthlyAmount : remainingAmount,
      remainingAmount,
      disbursementState.outstanding,
    );

    if (installmentAmount <= 0) {
      break;
    }

    if (execute) {
      await entryClient.query(
        `
          INSERT INTO loan_repayments (
            disbursement_id,
            staff_id,
            amount,
            repayment_date,
            month,
            payroll_batch_id,
            payment_method,
            remarks
          ) VALUES ($1, $2, $3, NOW(), $4, $5, 'payroll_deduction', $6)
        `,
        [
          disbursementState.id,
          deduction.staff_id,
          installmentAmount,
          repaymentMonth,
          batch.id,
          `Backfilled from payroll deduction snapshot for batch ${batch.batch_number}.`,
        ],
      );
    }

    disbursementState.outstanding = roundCurrency(disbursementState.outstanding - installmentAmount);
    disbursementState.dirty = true;
    remainingAmount = roundCurrency(remainingAmount - installmentAmount);
    insertedForEntry += 1;
    result.inserted += 1;
  }

  if (insertedForEntry === 0 && skippedForEntry === 0) {
    result.failed += 1;
    result.errors.push({
      staffName: deduction.staff_name,
      staffNumber: deduction.staff_number,
      error: 'No missing repayment month could be inserted from this payroll snapshot.',
    });
    return result;
  }

  if (execute && disbursementState.dirty) {
    await updateDisbursementBalances(entryClient, disbursementState);
  }

  return result;
}

async function processBatch(client, batch, execute) {
  const deductions = await getLoanDeductionsForBatch(client, batch.id);
  const summary = {
    batchNumber: batch.batch_number,
    payrollMonth: batch.payroll_month,
    status: batch.status,
    deductionEntries: deductions.length,
    inserted: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  if (deductions.length === 0) {
    return summary;
  }

  const dryRunCache = new Map();
  console.log(`Processing ${deductions.length} loan deduction entr${deductions.length === 1 ? 'y' : 'ies'} for batch ${batch.batch_number}...`);

  for (let index = 0; index < deductions.length; index += 1) {
    const deduction = deductions[index];
    try {
      if (execute) {
        await client.query('BEGIN');
      }

      const entryResult = await processDeductionEntry(client, batch, deduction, execute, dryRunCache);
      summary.inserted += entryResult.inserted;
      summary.skipped += entryResult.skipped;
      summary.failed += entryResult.failed;
      summary.errors.push(...entryResult.errors);

      if (execute) {
        await client.query('COMMIT');
      }
    } catch (error) {
      if (execute) {
        await client.query('ROLLBACK');
      }
      summary.failed += 1;
      summary.errors.push({
        staffName: deduction.staff_name,
        staffNumber: deduction.staff_number,
        error: error instanceof Error ? error.message : String(error || 'Unknown error'),
      });
    }

    if ((index + 1) % 25 === 0 || index === deductions.length - 1) {
      console.log(
        `[PROGRESS] ${batch.batch_number}: ${index + 1}/${deductions.length} processed | inserted=${summary.inserted} skipped=${summary.skipped} failed=${summary.failed}`,
      );
    }
  }

  return summary;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('Connected to database');
    await ensureRepaymentConstraint(client);

    const batches = await getCandidateBatches(client, args.batchId);
    if (batches.length === 0) {
      console.log('No locked/paid batches found for loan repayment backfill.');
      return;
    }

    console.log(`${args.execute ? 'EXECUTE' : 'DRY RUN'} mode for ${batches.length} batch(es).`);
    const overall = {
      batches: 0,
      deductionEntries: 0,
      inserted: 0,
      skipped: 0,
      failed: 0,
    };

    for (const batch of batches) {
      try {
        const summary = await processBatch(client, batch, args.execute);
        overall.batches += 1;
        overall.deductionEntries += summary.deductionEntries;
        overall.inserted += summary.inserted;
        overall.skipped += summary.skipped;
        overall.failed += summary.failed;

        console.log(
          `[${args.execute ? 'APPLIED' : 'PREVIEW'}] ${summary.batchNumber} ${summary.payrollMonth}: ${summary.inserted} insert(s), ${summary.skipped} skip(s), ${summary.failed} failure(s) from ${summary.deductionEntries} loan deduction entry(ies).`,
        );

        if (summary.errors.length > 0) {
          summary.errors.slice(0, 10).forEach((error) => {
            const label = String(error.staffName || '').trim() || 'Unknown staff';
            console.log(`  - ${label}: ${error.error}`);
          });
          if (summary.errors.length > 10) {
            console.log(`  - ...and ${summary.errors.length - 10} more`);
          }
        }
      } catch (error) {
        throw error;
      }
    }

    console.log('Summary:', JSON.stringify(overall, null, 2));
  } catch (error) {
    console.error('Loan repayment backfill failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
