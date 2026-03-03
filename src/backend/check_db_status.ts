
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DatabaseService } from './src/common/database/database.service';

async function checkDb() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService);

  try {
    console.log('Checking tables...');
    const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', tables.map(t => t.table_name).sort());

    console.log('\nChecking audit_trail count...');
    const auditCount = await db.queryOne('SELECT COUNT(*) as count FROM audit_trail');
    console.log('Audit Trail Count:', auditCount);

    console.log('\nChecking approval_workflows count...');
    try {
        const workflowCount = await db.queryOne('SELECT COUNT(*) as count FROM approval_workflows');
        console.log('Approval Workflows Count:', workflowCount);
    } catch (e) {
        console.log('Error checking approval_workflows (table might not exist):', e.message);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await app.close();
  }
}

checkDb();
