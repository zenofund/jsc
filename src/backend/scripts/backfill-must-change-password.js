require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const DEFAULT_PASSWORD = '12345678';
const APPLY = process.argv.includes('--apply');
const ALL_ROLES = process.argv.includes('--all-roles');
const COMPARE_CHUNK_SIZE = 25;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const roleClause = ALL_ROLES ? '' : "AND role = 'staff'";
    const candidates = (
      await client.query(
        `SELECT id, email, full_name, role, must_change_password, password_hash
         FROM users
         WHERE status = 'active'
           AND COALESCE(must_change_password, FALSE) = FALSE
           ${roleClause}
         ORDER BY created_at DESC`,
      )
    ).rows;

    const affected = [];
    for (let i = 0; i < candidates.length; i += COMPARE_CHUNK_SIZE) {
      const chunk = candidates.slice(i, i + COMPARE_CHUNK_SIZE);
      const results = await Promise.all(
        chunk.map(async (user) => ({
          user,
          matchesDefaultPassword: user.password_hash
            ? await bcrypt.compare(DEFAULT_PASSWORD, user.password_hash)
            : false,
        })),
      );

      for (const result of results) {
        if (result.matchesDefaultPassword) {
          const { password_hash, ...safeUser } = result.user;
          affected.push(safeUser);
        }
      }
    }

    console.log(
      JSON.stringify(
        {
          mode: APPLY ? 'apply' : 'dry-run',
          scope: ALL_ROLES ? 'all active users' : 'active staff users only',
          defaultPassword: DEFAULT_PASSWORD,
          scanned: candidates.length,
          affectedCount: affected.length,
          affected: affected.map((user) => ({
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
          })),
        },
        null,
        2,
      ),
    );

    if (!APPLY || affected.length === 0) {
      return;
    }

    const ids = affected.map((user) => user.id);
    await client.query(
      `UPDATE users
       SET must_change_password = TRUE,
           updated_at = NOW()
       WHERE id = ANY($1::uuid[])`,
      [ids],
    );

    console.log(
      JSON.stringify(
        {
          updatedCount: ids.length,
          updatedIds: ids,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
