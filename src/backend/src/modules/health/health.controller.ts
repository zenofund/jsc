import { Controller, Get, Head } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Head()
  @Public()
  @ApiOperation({ summary: 'Check API health status' })
  @ApiResponse({ status: 200, description: 'API is healthy' })
  async check() {
    return this.healthService.check();
  }

  @Get('database')
  @Public()
  @ApiOperation({ summary: 'Check database connection status' })
  @ApiResponse({ status: 200, description: 'Database connection is healthy' })
  @ApiResponse({ status: 503, description: 'Database connection failed' })
  async checkDatabase() {
    return this.healthService.checkDatabase();
  }

  @Get('detailed')
  @Public()
  @ApiOperation({ summary: 'Get detailed system health information' })
  @ApiResponse({ status: 200, description: 'Detailed health information' })
  async getDetailedHealth() {
    return this.healthService.getDetailedHealth();
  }
}
