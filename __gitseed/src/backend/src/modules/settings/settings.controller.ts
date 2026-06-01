import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

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
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Update system settings' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async updateSettings(@Body() settings: any, @Request() req) {
    return this.settingsService.updateSettings(settings, req.user.userId);
  }

  @Get('tax-configuration')
  @ApiOperation({ summary: 'Get tax configuration' })
  async getTaxConfiguration() {
    return this.settingsService.getTaxConfiguration();
  }

  @Put('tax-configuration')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Update tax configuration' })
  async updateTaxConfiguration(@Body() config: any, @Request() req) {
    return this.settingsService.updateTaxConfiguration(config, req.user.userId);
  }
}
