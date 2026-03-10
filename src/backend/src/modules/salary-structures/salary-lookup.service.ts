import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';

/**
 * Service for looking up salary information from salary structures
 * This centralizes salary calculation logic across the application
 */
@Injectable()
export class SalaryLookupService {
  private readonly logger = new Logger(SalaryLookupService.name);

  constructor(private databaseService: DatabaseService) {}

  private async getAllowedGrades(): Promise<string[]> {
    const row = await this.databaseService.queryOne(
      `SELECT value->'allowed_grades' AS allowed
       FROM system_settings
       WHERE key = 'general_settings'`,
    );
    const arr = row?.allowed;
    if (Array.isArray(arr)) {
      return arr.map((n: any) => String(n)).filter((n: string) => n.length > 0);
    }
    return ['3', '4', '5', '6', '7', '8', '9', '10', '12', '13', '14', '15', '16', '17'];
  }

  /**
   * Get the currently active salary structure
   * Caches the result to avoid repeated database calls within the same request
   */
  async getActiveStructure() {
    const structure = await this.databaseService.queryOne(
      `SELECT * FROM salary_structures 
       WHERE status = 'active' 
       ORDER BY effective_date DESC 
       LIMIT 1`,
      [],
    );

    if (!structure) {
      throw new NotFoundException('No active salary structure found. Please configure a salary structure first.');
    }

    return structure;
  }

  /**
   * Get basic salary for a specific grade level and step
   * Uses the currently active salary structure
   * 
   * @param gradeLevel - The grade level (e.g., 7, 8, 9)
   * @param step - The step within the grade level (e.g., 1, 2, 3)
   * @returns The basic salary amount
   */
  async getBasicSalary(gradeLevel: string | number, step: number): Promise<number> {
    const structure = await this.getActiveStructure();

    // Parse the grade_levels JSONB
    const gradeLevels = structure.grade_levels;
    
    if (!Array.isArray(gradeLevels)) {
      this.logger.error('Invalid salary structure format - grade_levels is not an array');
      throw new Error('Invalid salary structure format');
    }

    // Find the grade level
    const gradeKey = String(gradeLevel).trim();
    const grade = gradeLevels.find((g: any) => String(g.level).trim().toUpperCase() === gradeKey.toUpperCase());
    
    if (!grade) {
      throw new NotFoundException(
        `Grade level ${gradeKey} not found in active salary structure "${structure.name}"`
      );
    }

    // Find the step
    const stepData = grade.steps?.find((s: any) => s.step === step);
    
    if (!stepData) {
      throw new NotFoundException(
        `Step ${step} not found in grade level ${gradeKey} in salary structure "${structure.name}"`
      );
    }

    const basicSalary = parseFloat(stepData.basic_salary);

    if (isNaN(basicSalary) || basicSalary <= 0) {
      this.logger.error(
        `Invalid basic salary for Grade ${gradeKey} Step ${step}: ${stepData.basic_salary}`
      );
      throw new Error('Invalid basic salary in salary structure');
    }

    return basicSalary;
  }

  /**
   * Get basic salary for multiple staff members in batch
   * More efficient than calling getBasicSalary multiple times
   * 
   * @param staffList - Array of objects with gradeLevel and step
   * @returns Map of "gradeLevel-step" to basic salary
   */
  async getBasicSalariesBatch(
    staffList: Array<{ gradeLevel: string | number; step: number }>
  ): Promise<Map<string, number>> {
    const structure = await this.getActiveStructure();
    const gradeLevels = structure.grade_levels;
    
    if (!Array.isArray(gradeLevels)) {
      throw new Error('Invalid salary structure format');
    }

    const salaryMap = new Map<string, number>();

    for (const staff of staffList) {
      const key = `${String(staff.gradeLevel)}-${staff.step}`;
      
      // Skip if already calculated
      if (salaryMap.has(key)) {
        continue;
      }

      // Find the grade level
      const grade = gradeLevels.find((g: any) => String(g.level).trim().toUpperCase() === String(staff.gradeLevel).trim().toUpperCase());
      
      if (!grade) {
        this.logger.warn(
          `Grade level ${staff.gradeLevel} not found in salary structure`
        );
        continue;
      }

      // Find the step
      const stepData = grade.steps?.find((s: any) => s.step === staff.step);
      
      if (!stepData) {
        this.logger.warn(
        `Step ${staff.step} not found in grade level ${staff.gradeLevel}`
        );
        continue;
      }

      const basicSalary = parseFloat(stepData.basic_salary);
      
      if (!isNaN(basicSalary) && basicSalary > 0) {
        salaryMap.set(key, basicSalary);
      }
    }

    return salaryMap;
  }

  /**
   * Get salary details including structure information
   * 
   * @param gradeLevel - The grade level
   * @param step - The step
   * @returns Detailed salary information
   */
  async getSalaryDetails(gradeLevel: string | number, step: number) {
    const structure = await this.getActiveStructure();
    const basicSalary = await this.getBasicSalary(gradeLevel, step);

    return {
      gradeLevel,
      step,
      basicSalary,
      structureId: structure.id,
      structureName: structure.name,
      structureCode: structure.code,
      effectiveDate: structure.effective_date,
    };
  }

  /**
   * Validate that a grade level and step exist in the current structure
   * Useful for validation during staff creation/updates
   * 
   * @param gradeLevel - The grade level to validate
   * @param step - The step to validate
   * @returns true if valid, throws error if not
   */
  async validateGradeAndStep(gradeLevel: string | number, step: number): Promise<boolean> {
    try {
      const allowed = await this.getAllowedGrades();
      const gradeKey = String(gradeLevel).trim();
      const isNumeric = /^\d+$/.test(gradeKey);
      if (isNumeric && allowed.length > 0 && !allowed.includes(gradeKey)) {
        throw new NotFoundException(
          `Grade level ${gradeKey} is not permitted. Allowed grades: ${allowed.join(', ')}.`
        );
      }
      await this.getBasicSalary(gradeLevel, step);
      return true;
    } catch (error) {
      throw new NotFoundException(
        `Invalid grade level ${gradeLevel} and step ${step}. ` +
        `Please ensure this combination exists in the active salary structure.`
      );
    }
  }
}
