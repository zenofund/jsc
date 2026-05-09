
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DatabaseService } from './src/common/database/database.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService);

  console.log('Fixing status for items created by Payroll Loaders...');

  // 1. Fix Allowances
  const allowancesResult = await db.query(
    `UPDATE staff_allowances sa
     SET status = 'pending', updated_at = NOW()
     FROM users u
     WHERE sa.created_by = u.id
     AND u.role = 'payroll_loader'
     AND sa.status = 'active'
     RETURNING sa.id, sa.staff_id, sa.allowance_id`
  );
  console.log(`Updated ${allowancesResult.length} allowances to Pending.`);

  // 2. Fix Deductions
  const deductionsResult = await db.query(
    `UPDATE staff_deductions sd
     SET status = 'pending', updated_at = NOW()
     FROM users u
     WHERE sd.created_by = u.id
     AND u.role = 'payroll_loader'
     AND sd.status = 'active'
     RETURNING sd.id, sd.staff_id, sd.deduction_id`
  );
  console.log(`Updated ${deductionsResult.length} deductions to Pending.`);

  await app.close();
}

bootstrap();
