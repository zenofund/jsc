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
      const securityDefaults = {
        enforce_2fa: false,
        single_session_only: false,
        inactivity_logout_minutes: 30,
        max_failed_login_attempts: 5,
        lockout_minutes: 15,
        geo_fencing_enabled: false,
        office_latitude: null,
        office_longitude: null,
        office_radius_meters: 100,
        allowed_ip_range: '',
        trusted_network_fallback: '',
      };

      return {
        ...securityDefaults,
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
      enforce_2fa: false,
      single_session_only: false,
      inactivity_logout_minutes: 30,
      max_failed_login_attempts: 5,
      lockout_minutes: 15,
      geo_fencing_enabled: false,
      office_latitude: null,
      office_longitude: null,
      office_radius_meters: 100,
      allowed_ip_range: '',
      trusted_network_fallback: '',
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
      allowed_grades,
      enforce_2fa,
      single_session_only,
      inactivity_logout_minutes,
      max_failed_login_attempts,
      lockout_minutes,
      geo_fencing_enabled,
      office_latitude,
      office_longitude,
      office_radius_meters,
      allowed_ip_range,
      trusted_network_fallback,
    } = settings;

    const parseBoolean = (v: any) => {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        return s === 'true' || s === '1' || s === 'yes' || s === 'on';
      }
      return false;
    };

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
        : [3,4,5,6,7,8,9,10,12,13,14,15,16,17],
      enforce_2fa: parseBoolean(enforce_2fa),
      single_session_only: parseBoolean(single_session_only),
      inactivity_logout_minutes: Number.isFinite(Number(inactivity_logout_minutes))
        ? Math.max(0, Number(inactivity_logout_minutes))
        : 30,
      max_failed_login_attempts: Number.isFinite(Number(max_failed_login_attempts))
        ? Math.max(1, Number(max_failed_login_attempts))
        : 5,
      lockout_minutes: Number.isFinite(Number(lockout_minutes))
        ? Math.max(1, Number(lockout_minutes))
        : 15,
      geo_fencing_enabled: parseBoolean(geo_fencing_enabled),
      office_latitude: Number.isFinite(Number(office_latitude)) ? Number(office_latitude) : null,
      office_longitude: Number.isFinite(Number(office_longitude)) ? Number(office_longitude) : null,
      office_radius_meters: Number.isFinite(Number(office_radius_meters)) && Number(office_radius_meters) > 0
        ? Number(office_radius_meters)
        : 100,
      allowed_ip_range: typeof allowed_ip_range === 'string' ? allowed_ip_range.trim() : '',
      trusted_network_fallback: typeof trusted_network_fallback === 'string' ? trusted_network_fallback.trim() : '',
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
