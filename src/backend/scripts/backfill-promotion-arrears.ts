import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PromotionsService } from '../src/modules/promotions/promotions.service';

function parseArgs(argv: string[]) {
  const args: {
    execute: boolean;
    promotionId?: string;
    limit?: number;
    notify: boolean;
  } = {
    execute: false,
    notify: true,
  };

  for (const arg of argv) {
    if (arg === '--execute') {
      args.execute = true;
      continue;
    }
    if (arg === '--no-notify') {
      args.notify = false;
      continue;
    }
    if (arg.startsWith('--promotion-id=')) {
      args.promotionId = arg.split('=').slice(1).join('=').trim();
      continue;
    }
    if (arg.startsWith('--limit=')) {
      const parsed = Number(arg.split('=').slice(1).join('=').trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        args.limit = parsed;
      }
    }
  }

  return args;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const promotionsService = app.get(PromotionsService);
    const summary = await promotionsService.backfillApprovedPromotionArrears({
      promotionId: args.promotionId,
      limit: args.limit,
      execute: args.execute,
      notify: args.notify,
    });

    console.log(`${args.execute ? 'EXECUTE' : 'DRY RUN'} summary:`);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error('Promotion arrears backfill failed:', error);
  process.exit(1);
});
