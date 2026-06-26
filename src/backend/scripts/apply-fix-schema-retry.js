const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const fs = require('fs');

async function applyWithOptions(sslOption) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: sslOption,
  });

  try {
    await client.connect();
    console.log(`✅ Connected to database (ssl=${!!sslOption})`);

    const schemaPath = path.resolve(__dirname, '../database/fix-schema-gaps.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('🚀 Applying updates to database...');
    await client.query(schemaSql);
    console.log('✅ Updates applied successfully!');
    return true;
  } catch (err) {
    console.error(`Connection/apply error (ssl=${!!sslOption}):`, err.message || err);
    return false;
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

(async function main(){
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set in environment');
    process.exit(1);
  }

  // Try with TLS (rejectUnauthorized false)
  const tlsOption = { rejectUnauthorized: false };
  let ok = await applyWithOptions(tlsOption);
  if (!ok) {
    console.log('ℹ️ Retrying without TLS...');
    ok = await applyWithOptions(false);
  }

  if (!ok) {
    console.error('❌ Failed to apply schema updates with both TLS and non-TLS');
    process.exit(1);
  }
})();
