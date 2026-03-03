import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';

@Injectable()
export class DepartmentsService {
  constructor(private databaseService: DatabaseService) {}

  async create(dto: any, userId?: string) {
    // Support both camelCase and snake_case for flexibility
    const name = dto.name;
    const code = dto.code;
    const description = dto.description;
    const headOfDepartment = dto.headOfDepartment || dto.head_of_department;
    const budgetCode = dto.budgetCode || dto.budget_code;
    const location = dto.location;
    
    // Check if code already exists
    const existing = await this.databaseService.queryOne(
      'SELECT id FROM departments WHERE code = $1',
      [code]
    );

    if (existing) {
      throw new Error(`Department with code ${code} already exists`);
    }

    return this.databaseService.queryOne(
      `INSERT INTO departments (
        name, 
        code, 
        description, 
        head_of_department, 
        budget_code,
        location,
        created_by,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') 
      RETURNING *`,
      [
        name,
        code,
        description,
        headOfDepartment || null,
        budgetCode || null,
        location || null,
        userId || null
      ]
    );
  }

  async findAll() {
    return this.databaseService.query(
      `SELECT * FROM departments WHERE status = 'active' ORDER BY name`,
    );
  }

  async findOne(id: string) {
    return this.databaseService.queryOne(
      'SELECT * FROM departments WHERE id = $1',
      [id],
    );
  }

  async update(id: string, dto: any, userId?: string) {
    const updates = [];
    const params: any[] = [];
    let idx = 1;
    Object.entries(dto || {}).forEach(([key, value]) => {
      // Skip undefined or empty string values that are not valid UUIDs for specific fields
      if (value !== undefined && value !== '') {
        const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
        updates.push(`${snakeKey} = $${idx}`);
        params.push(value);
        idx++;
      } else if (value === '' && key === 'head_of_department') {
        // Handle empty head_of_department as NULL
        const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
        updates.push(`${snakeKey} = NULL`);
      }
    });
    if (updates.length === 0) {
      return this.findOne(id);
    }
    updates.push(`updated_at = NOW()`);
    const query = `
      UPDATE departments
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `;
    const result = await this.databaseService.queryOne(query, [...params, id]);
    return result;
  }
}
