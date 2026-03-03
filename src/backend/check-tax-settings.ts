import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DatabaseService } from './src/common/database/database.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DatabaseService);

  try {
    console.log('Checking system_settings table columns...');
    const columns = await db.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'system_settings'"
    );
    console.table(columns);

    console.log("Checking content of system_settings where id='default'...");
    try {
        const defaultSettings = await db.query("SELECT * FROM system_settings WHERE id = 'default'");
        console.log('Found by id=default:', defaultSettings);
    } catch (e) {
        console.log('Error querying by id=default:', e.message);
    }

    console.log("Checking content of system_settings where key='tax_configuration'...");
    const taxSettings = await db.query("SELECT * FROM system_settings WHERE key = 'tax_configuration'");
    console.log('Found by key=tax_configuration:', taxSettings);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
