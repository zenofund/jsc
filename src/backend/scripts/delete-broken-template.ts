import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function deleteTemplate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const templateId = '97e414ed-da71-443e-94aa-d2d0aa103c3f';
    
    // Check if it exists first
    const res = await client.query('SELECT * FROM report_templates WHERE id = $1', [templateId]);
    if (res.rows.length === 0) {
        console.log(`Template ${templateId} not found.`);
        return;
    }

    console.log(`Deleting template: ${res.rows[0].name} (${templateId})`);

    await client.query('DELETE FROM report_templates WHERE id = $1', [templateId]);
    console.log('✅ Template deleted successfully.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

deleteTemplate();
