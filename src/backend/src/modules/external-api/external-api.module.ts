import { Module } from '@nestjs/common';
import { ExternalApiController, ApiKeyAdminController } from './external-api.controller';
import { ExternalApiService } from './external-api.service';
import { DatabaseModule } from '@common/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ExternalApiController, ApiKeyAdminController],
  providers: [ExternalApiService],
  exports: [ExternalApiService],
})
export class ExternalApiModule {}
