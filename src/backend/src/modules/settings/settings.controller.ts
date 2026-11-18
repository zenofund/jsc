import { Controller, Get, Put, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

const COOP_ONLY_KEYS = ['loan_management_enabled', 'cooperative_management_enabled'] as const;
type CoopOnlyKey = typeof COOP_ONLY_KEYS[number];

const isCoopOnlyKey = (k: string): k is CoopOnlyKey =>
  (COOP_ONLY_KEYS as readonly string[]).includes(k);

const normalizeRole = (r: unknown): string => String(r || '').trim().toLowerCase();

const isCoopManager = (user: any): boolean => normalizeRole(user?.role) === 'coop_manager';
const isPolicyAdmin = (user: any): boolean => normalizeRole(user?.role) === 'policy_admin';
const isSuperAdmin = (user: any): boolean => normalizeRole(user?.role) === 'super_admin';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get system settings' })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Put()
  @Roles('super_admin', 'policy_admin', 'coop_manager')
  @ApiOperation({ summary: 'Update system settings or policy workflow (Coop Manager may only toggle Cooperative modules)' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async updateSettings(@Body() settings: any, @Request() req) {
    const user = req.user;

    if (isCoopManager(user)) {
      const incomingKeys = Object.keys(settings || {});
      const disallowed = incomingKeys.filter((k) => !isCoopOnlyKey(k));
      if (disallowed.length > 0) {
        throw new ForbiddenException(
          'Cooperative Manager can only modify loan_management_enabled and cooperative_management_enabled settings',
        );
      }
    } else if (isPolicyAdmin(user)) {
      const disallowed = Object.keys(settings || {}).filter((key) => key !== 'approval_workflow');
      if (disallowed.length > 0) {
        throw new ForbiddenException('Policy Admin can only modify the approval workflow');
      }
    } else if (!isSuperAdmin(user)) {
      throw new ForbiddenException('You do not have permission to update system settings');
    } else if (Object.keys(settings || {}).some(isCoopOnlyKey)) {
      throw new ForbiddenException('Super Admin cannot modify Cooperative or Loan module settings');
    }

    return this.settingsService.updateSettings(settings, req.user.userId);
  }

  @Get('tax-configuration')
  @ApiOperation({ summary: 'Get tax configuration' })
  async getTaxConfiguration() {
    return this.settingsService.getTaxConfiguration();
  }

  @Put('tax-configuration')
  @Roles('policy_admin')
  @ApiOperation({ summary: 'Update tax configuration' })
  async updateTaxConfiguration(@Body() config: any, @Request() req) {
    return this.settingsService.updateTaxConfiguration(config, req.user.userId);
  }
}
