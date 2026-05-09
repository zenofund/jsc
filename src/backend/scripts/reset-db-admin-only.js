const bcrypt = require('bcrypt');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function resetDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN (
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
            AND tablename NOT IN ('schema_migrations', 'supabase_migrations', 'migrations')
        ) LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
        END LOOP;
      END $$;
    `);

    const passwordHash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role,
           status = 'active'`,
      ['admin@jsc.gov.ng', passwordHash, 'System Administrator', 'admin'],
    );

    await client.query('COMMIT');
    console.log('Database reset complete. Admin user ensured.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

resetDatabase().catch((error) => {
  console.error('Database reset failed.');
  console.error(error);
  process.exit(1);
});
