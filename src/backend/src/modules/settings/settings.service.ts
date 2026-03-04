import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/dto/audit.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async getSettings() {
    const result = await this.databaseService.queryOne(
      `SELECT value, updated_at FROM system_settings WHERE key = 'general_settings'`,
    );

    if (result?.value) {
      return {
        ...result.value,
        allowed_grades: Array.isArray(result.value.allowed_grades)
          ? result.value.allowed_grades
          : [3,4,5,6,7,8,9,10,12,13,14,15,16,17],
        created_at: new Date().toISOString(),
        updated_at: result.updated_at || new Date().toISOString(),
      };
    }

    return {
      organization_name: 'Judicial Service Committee',
      organization_logo: '',
      payroll_prefix: 'JSC',
      payday_day: 25,
      auto_generate_payslips: true,
      app_version: '1.0.1',
      approval_workflow: [],
      tax_zones: [],
      allowed_grades: [3,4,5,6,7,8,9,10,12,13,14,15,16,17],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async updateSettings(settings: any, userId: string) {
    // Get old settings for audit log
    const oldSettings = await this.getSettings();

    // Extract only the fields we want to save to avoid pollution
    const {
      organization_name,
      organization_logo,
      payroll_prefix,
      payday_day,
      auto_generate_payslips,
      app_version,
      approval_workflow,
      tax_zones,
      allowed_grades
    } = settings;

    const value = {
      organization_name,
      organization_logo,
      payroll_prefix,
      payday_day,
      auto_generate_payslips,
      app_version,
      approval_workflow,
      tax_zones,
      allowed_grades: Array.isArray(allowed_grades)
        ? allowed_grades
        : [3,4,5,6,7,8,9,10,12,13,14,15,16,17]
    };

    await this.databaseService.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('general_settings', $1, NOW())
       ON CONFLICT (key) 
       DO UPDATE SET value = $1, updated_at = NOW()`,
      [value],
    );

    // Audit Log
    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entity: 'system_settings',
      entityId: 'general_settings',
      description: 'Updated system settings',
      oldValues: oldSettings,
      newValues: value,
    });

    return this.getSettings();
  }

  async getTaxConfiguration() {
    const result = await this.databaseService.queryOne(
      `SELECT tax_configuration FROM system_settings WHERE key = 'general_settings'`,
    );
    return result?.tax_configuration || {};
  }

  async updateTaxConfiguration(config: any, userId: string) {
    const oldConfig = await this.getTaxConfiguration();

    await this.databaseService.query(
      `UPDATE system_settings 
       SET tax_configuration = $1, updated_at = NOW() 
       WHERE key = 'general_settings'`,
      [config],
    );

    // Audit Log
    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entity: 'system_settings',
      entityId: 'tax_configuration',
      description: 'Updated tax configuration',
      oldValues: oldConfig,
      newValues: config,
    });

    return this.getTaxConfiguration();
  }
}
