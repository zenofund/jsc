const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  await client.connect();

  console.log('🔎 Fetching active salary structure...');
  const structure = await client
    .query(
      `SELECT id, name, code, grade_levels
       FROM salary_structures
       WHERE status = 'active'
       ORDER BY effective_date DESC
       LIMIT 1`,
    )
    .then((r) => r.rows[0])
    .catch((e) => {
      console.error('Failed to fetch active salary structure:', e);
      process.exit(1);
    });

  if (!structure) {
    console.error('❌ No active salary structure found.');
    process.exit(1);
  }

  const gradeLevels = structure.grade_levels;
  if (!Array.isArray(gradeLevels)) {
    console.error('❌ Invalid structure format: grade_levels is not an array.');
    process.exit(1);
  }

  const grade12 = gradeLevels.find((g) => g.level === 12);
  if (!grade12 || !Array.isArray(grade12.steps)) {
    console.error('❌ Grade level 12 not found in active salary structure or steps missing.');
    process.exit(1);
  }

  // Build a map: step -> basic_salary for GL12
  const stepToSalary = new Map();
  for (const s of grade12.steps) {
    const val = parseFloat(s.basic_salary);
    if (!isNaN(val)) {
      stepToSalary.set(Number(s.step), val);
    }
  }

  console.log('🔎 Fetching staff on Grade Level 11...');
  const staffOn11 = await client
    .query(
      `SELECT id, staff_number, first_name, last_name, grade_level, step
       FROM staff
       WHERE grade_level = 11`,
    )
    .then((r) => r.rows)
    .catch((e) => {
      console.error('Failed to fetch staff on GL 11:', e);
      process.exit(1);
    });

  if (staffOn11.length === 0) {
    console.log('✅ No staff on Grade Level 11. Nothing to migrate.');
    await client.end();
    process.exit(0);
  }

  console.log(`📋 Found ${staffOn11.length} staff on GL 11. Migrating to GL 12...`);

  let updated = 0;
  let skipped = 0;
  const details = [];

  for (const staff of staffOn11) {
    const sameStep = Number(staff.step);
    let targetSalary = stepToSalary.get(sameStep);

    // Fallback: find nearest lower step in GL12 if exact step is missing
    if (targetSalary === undefined) {
      const availableSteps = Array.from(stepToSalary.keys()).sort((a, b) => b - a); // desc
      const fallbackStep = availableSteps.find((st) => st <= sameStep) ?? availableSteps[availableSteps.length - 1];
      targetSalary = stepToSalary.get(fallbackStep);
    }

    if (targetSalary === undefined) {
      skipped++;
      details.push(
        `SKIP ${staff.staff_number}: No salary mapping for GL12 (step=${sameStep}).`,
      );
      continue;
    }

    try {
      await client.query(
        `UPDATE staff
         SET grade_level = 12,
             current_basic_salary = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [targetSalary, staff.id],
      );
      updated++;
      details.push(
        `OK   ${staff.staff_number}: GL 11 -> 12, step ${sameStep}, salary ₦${targetSalary.toLocaleString()}`,
      );
    } catch (e) {
      skipped++;
      details.push(`ERR  ${staff.staff_number}: ${e.message}`);
    }
  }

  console.log(`\n=== Migration Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  const logPath = path.join(__dirname, '../migration-logs');
  if (!fs.existsSync(logPath)) fs.mkdirSync(logPath, { recursive: true });
  const file = path.join(logPath, `migrate_gl11_to_gl12_${Date.now()}.log`);
  fs.writeFileSync(file, details.join('\n'), 'utf8');
  console.log(`Details written to: ${file}`);

  await client.end();
  console.log('✅ Migration completed.');
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});

