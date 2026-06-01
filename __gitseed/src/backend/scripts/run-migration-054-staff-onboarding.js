const { Client } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const sqlPath = path.resolve(__dirname, '../migrations/054_staff_onboarding_fields.sql');
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Migration file not found at: ${sqlPath}`);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  await client.connect();
  console.log('✅ Connected to database');

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration 054_staff_onboarding_fields.sql applied');

    const cols = [
      'zone',
      'qualification',
      'date_of_first_appointment',
      'post_on_first_appointment',
      'present_appointment',
      'date_of_present_appointment',
      'bank_code',
    ];
    const res = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='staff' AND column_name = ANY($1::text[]) ORDER BY column_name",
      [cols],
    );
    console.log('✅ Verified columns:', res.rows.map((r) => r.column_name).join(', '));

    const constraint = await client.query(
      "SELECT 1 FROM information_schema.table_constraints WHERE table_name='staff' AND constraint_name='staff_zone_allowed'",
    );
    console.log('✅ Verified constraint staff_zone_allowed:', constraint.rowCount ? 'present' : 'missing');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error?.message || error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error('❌ Migration runner failed:', e?.message || e);
  process.exit(1);
});

