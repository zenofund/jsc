/* eslint-disable no-console */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(backendRoot, '..');
dotenv.config({ path: path.join(repositoryRoot, '.env') });
dotenv.config({ path: path.join(repositoryRoot, '.env.production'), override: false });
dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, '.env.production'), override: false });

const migrationSources = [
  { directory: path.join(backendRoot, 'migrations'), label: 'migrations' },
  { directory: path.join(backendRoot, 'database', 'migrations'), label: 'database/migrations' },
];
const baselineCutoff = 64;

function discoverMigrations() {
  const files = [];
  for (const source of migrationSources) {
    if (!fs.existsSync(source.directory)) continue;
    for (const filename of fs.readdirSync(source.directory)) {
      if (!/^\d+_.+\.sql$/i.test(filename)) continue;
      const number = Number(filename.match(/^\d+/)[0]);
      const fullPath = path.join(source.directory, filename);
      files.push({
        id: `${source.label}/${filename}`,
        filename,
        number,
        fullPath,
        sql: fs.readFileSync(fullPath, 'utf8'),
      });
    }
  }
  return files.sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
}

function checksum(sql) {
  return crypto.createHash('sha256').update(sql).digest('hex');
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      execution_ms INTEGER NOT NULL DEFAULT 0,
      is_baseline BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS schema_migrations_filename_key
      ON schema_migrations (filename);
  `);
}

async function recordBaseline(client, migration) {
  await client.query(
    `INSERT INTO schema_migrations (id, filename, checksum, execution_ms, is_baseline)
     VALUES ($1, $2, $3, 0, TRUE)
     ON CONFLICT (id) DO NOTHING`,
    [migration.id, migration.id, checksum(migration.sql)],
  );
}

async function bootstrapAndBaseline(client, migrations) {
  const { rows } = await client.query(`
    SELECT to_regclass('public.staff') IS NULL AS is_empty
  `);
  if (rows[0].is_empty) {
    const schemaPath = path.join(backendRoot, 'database', 'schema-full.sql');
    if (!fs.existsSync(schemaPath)) throw new Error(`Base schema not found: ${schemaPath}`);
    console.log('Applying the canonical base schema to the empty database...');
    await client.query(fs.readFileSync(schemaPath, 'utf8'));
  }

  // schema-full.sql is the repository baseline for migrations 001-064. Recording
  // that fact prevents old, non-repeatable scripts from being replayed on a
  // database that was created from the canonical schema or already existed.
  for (const migration of migrations.filter((item) => item.number <= baselineCutoff)) {
    await recordBaseline(client, migration);
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const migrations = discoverMigrations();
  if (!migrations.length) throw new Error('No SQL migrations were found.');
  if (args.has('--dry-run')) {
    migrations.forEach((migration) => console.log(`${String(migration.number).padStart(3, '0')} ${migration.id}`));
    return;
  }

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', ['jsc:schema-migrations']);
    await client.query('BEGIN');
    await ensureMigrationTable(client);
    await bootstrapAndBaseline(client, migrations);

    const appliedResult = await client.query('SELECT id, checksum FROM schema_migrations');
    const applied = new Map(appliedResult.rows.map((row) => [row.id, row.checksum]));
    const pending = migrations.filter((migration) => !applied.has(migration.id));
    const drift = migrations.filter((migration) => applied.get(migration.id) && applied.get(migration.id) !== checksum(migration.sql));
    if (drift.length) throw new Error(`Migration checksum drift detected: ${drift.map((item) => item.id).join(', ')}`);

    console.log(`Migration status: ${applied.size} applied, ${pending.length} pending.`);
    if (args.has('--status')) {
      migrations.forEach((migration) => console.log(`${applied.has(migration.id) ? 'applied' : 'pending'}  ${migration.id}`));
      await client.query('COMMIT');
      return;
    }

    for (const migration of pending) {
      const started = Date.now();
      console.log(`Applying ${migration.id}...`);
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO schema_migrations (id, filename, checksum, execution_ms)
         VALUES ($1, $2, $3, $4)`,
        [migration.id, migration.id, checksum(migration.sql), Date.now() - started],
      );
    }
    await client.query('COMMIT');
    console.log(`Database is up to date (${migrations.length} migrations tracked).`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['jsc:schema-migrations']).catch(() => undefined);
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Database migration failed: ${error.message}`);
  process.exitCode = 1;
});
