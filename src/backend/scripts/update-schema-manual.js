const { Client } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function runUpdate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to Neon database');

    const schemaPath = path.resolve(__dirname, '../database/update-notifications.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    console.log('📝 Reading update-notifications.sql...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('🚀 Applying updates to database...');
    await client.query(schemaSql);
    
    console.log('✅ Updates applied successfully!');
    
  } catch (error) {
    console.error('❌ Error applying updates:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runUpdate();
