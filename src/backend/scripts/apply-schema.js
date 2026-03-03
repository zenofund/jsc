const { Client } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function runSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to Neon database');

    const schemaPath = path.resolve(__dirname, '../database/schema-full.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    console.log('📝 Reading schema.sql...');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('🚀 Applying schema to database...');
    // Enable uuid-ossp extension first
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    
    // Execute the schema SQL
    await client.query(schemaSql);
    
    console.log('✅ Schema applied successfully!');
    
  } catch (error) {
    console.error('❌ Error applying schema:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSchema();
