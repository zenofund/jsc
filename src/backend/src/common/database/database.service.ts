import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Initialize PostgreSQL pool for direct database access
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    
    if (!databaseUrl) {
      this.logger.error('Database configuration missing!');
      throw new Error('DATABASE_URL must be set');
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      this.logger.log('✅ PostgreSQL connection established successfully');
      client.release();
    } catch (error) {
      this.logger.error('❌ PostgreSQL connection failed:', error);
      throw error;
    }

    this.logger.log('✅ Database service initialized');
  }

  /**
   * Get PostgreSQL pool for direct queries
   */
  getPool(): Pool {
    return this.pool;
  }

  /**
   * Execute a query with parameters
   */
  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a query and return a single row
   */
  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Bulk insert helper
   */
  async bulkInsert<T>(tableName: string, records: T[], client?: any): Promise<void> {
    if (records.length === 0) return;

    const keys = Object.keys(records[0]);
    const columns = keys.join(', ');
    
    const valuePlaceholders = records
      .map((_, recordIndex) => {
        const placeholders = keys
          .map((_, keyIndex) => `$${recordIndex * keys.length + keyIndex + 1}`)
          .join(', ');
        return `(${placeholders})`;
      })
      .join(', ');

    const values = records.flatMap((record) => keys.map((key) => record[key]));

    const query = `INSERT INTO ${tableName} (${columns}) VALUES ${valuePlaceholders}`;
    try {
      if (client) {
        await client.query(query, values);
      } else {
        await this.query(query, values);
      }
    } catch (error) {
      this.logger.error(`Bulk insert failed for table ${tableName}`);
      this.logger.error(`Query: ${query.substring(0, 500)}...`);
      this.logger.error(`First record values: ${JSON.stringify(values.slice(0, keys.length))}`);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
