import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '@common/database/database.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private databaseService: DatabaseService,
    private configService: ConfigService,
  ) {}

  /**
   * Basic health check
   */
  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.get<string>('NODE_ENV'),
    };
  }

  /**
   * Database connection check
   */
  async checkDatabase() {
    try {
      const isHealthy = await this.databaseService.healthCheck();
      
      if (!isHealthy) {
        return {
          status: 'error',
          database: 'disconnected',
          message: 'Database connection failed',
          timestamp: new Date().toISOString(),
        };
      }

      // Get database version and connection info
      const versionResult = await this.databaseService.queryOne<{ version: string }>(
        'SELECT version() as version'
      );

      const dbStats = await this.databaseService.queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = \'public\''
      );

      return {
        status: 'ok',
        database: 'connected',
        postgresql: {
          version: versionResult?.version || 'Unknown',
          tables: parseInt(dbStats?.count || '0'),
        },
        supabase: {
          url: this.configService.get<string>('SUPABASE_URL'),
          configured: !!this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY'),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return {
        status: 'error',
        database: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Detailed system health information
   */
  async getDetailedHealth() {
    const basicHealth = await this.check();
    const databaseHealth = await this.checkDatabase();

    // Check each table
    const tableStats = {};
    try {
      const tables = ['users', 'staff', 'departments', 'allowances', 'deductions'];
      
      for (const table of tables) {
        try {
          const result = await this.databaseService.queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM ${table}`
          );
          tableStats[table] = parseInt(result?.count || '0');
        } catch (error) {
          tableStats[table] = 'error';
        }
      }
    } catch (error) {
      this.logger.error('Error getting table stats:', error);
    }

    return {
      ...basicHealth,
      database: databaseHealth,
      tables: tableStats,
      configuration: {
        port: this.configService.get<number>('PORT'),
        apiPrefix: this.configService.get<string>('API_PREFIX'),
        nodeEnv: this.configService.get<string>('NODE_ENV'),
        corsConfigured: !!this.configService.get<string>('CORS_ORIGINS'),
        jwtConfigured: !!this.configService.get<string>('JWT_SECRET'),
      },
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
      },
    };
  }
}
