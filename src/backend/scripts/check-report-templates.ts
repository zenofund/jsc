import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkTemplates() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const res = await client.query('SELECT * FROM report_templates');
    const templates = res.rows;

    let found = false;
    for (const template of templates) {
      let config;
      try {
        config = typeof template.config === 'string' ? JSON.parse(template.config) : template.config;
      } catch (e) {
        console.error(`Failed to parse config for template ${template.id}`);
        continue;
      }

      if (config.joins) {
        for (const join of config.joins) {
            // Check if base table (implied from fields) is payroll_batches
            // The config usually has 'fields' array. We assume the first field determines base table or we check all fields.
            const tablesInFields = new Set(config.fields.map((f: any) => f.table));
            
            if (tablesInFields.has('payroll_batches') && join.table === 'staff' && join.onField === 'staff_id') {
                console.log(`\n🔴 FOUND BROKEN TEMPLATE:`);
                console.log(`ID: ${template.id}`);
                console.log(`Name: ${template.name}`);
                console.log('Issue: Invalid join detected: payroll_batches.staff_id -> staff.id');
                found = true;
            }
        }
      }
    }

    if (!found) {
        console.log('\n✅ No broken templates found matching the criteria.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkTemplates();
