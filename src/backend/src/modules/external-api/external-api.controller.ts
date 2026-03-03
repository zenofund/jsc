import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Request,
  UnauthorizedException,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader, ApiSecurity } from '@nestjs/swagger';
import { ExternalApiService } from './external-api.service';
import {
  CreateApiKeyDto,
  CreateExternalDeductionDto,
  CreateWebhookDto,
  QueryStaffDto,
} from './dto/external-api.dto';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { Public } from '@common/decorators/public.decorator';

// ==================== ADMIN ENDPOINTS (API Key Management) ====================

@ApiTags('External API - Admin')
@ApiBearerAuth()
@Controller('api-keys')
@UseGuards(RolesGuard)
export class ApiKeyAdminController {
  constructor(private externalApiService: ExternalApiService) {}

  @Post()
  @Roles('Admin')
  @ApiOperation({ summary: 'Create new API key for external system' })
  @ApiResponse({ status: 201, description: 'API key created successfully' })
  async createApiKey(@Body() dto: CreateApiKeyDto, @Request() req) {
    return this.externalApiService.createApiKey(dto, req.user.userId);
  }

  @Get()
  @Roles('Admin')
  @ApiOperation({ summary: 'List all API keys' })
  @ApiResponse({ status: 200, description: 'API keys retrieved successfully' })
  async listApiKeys() {
    return this.externalApiService.listApiKeys();
  }

  @Delete(':id')
  @Roles('Admin')
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiResponse({ status: 200, description: 'API key revoked successfully' })
  async revokeApiKey(@Param('id') id: string, @Request() req) {
    return this.externalApiService.revokeApiKey(id, req.user.userId);
  }
}

// ==================== EXTERNAL API ENDPOINTS (For Cooperative System) ====================

@ApiTags('External API - Integration')
@ApiSecurity('api-key')
@Controller('external/v1')
export class ExternalApiController {
  constructor(private externalApiService: ExternalApiService) {}

  /**
   * Validate API key from header
   */
  private async validateRequest(headers: any, requiredScope?: string) {
    const apiKey = headers['x-api-key'];
    
    if (!apiKey) {
      throw new UnauthorizedException('API key is required in X-API-Key header');
    }

    return await this.externalApiService.validateApiKey(apiKey, requiredScope);
  }

  // ==================== STAFF ENDPOINTS ====================

  @Public()
  @Get('staff')
  @ApiOperation({ summary: 'Get staff list' })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({ status: 200, description: 'Staff list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Invalid API key or missing scope' })
  async getStaff(@Headers() headers: any, @Query() query: QueryStaffDto) {
    await this.validateRequest(headers, 'read:staff');
    return this.externalApiService.getStaff(query);
  }

  @Public()
  @Get('staff/:id')
  @ApiOperation({ summary: 'Get staff details by ID' })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({ status: 200, description: 'Staff details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Staff not found' })
  async getStaffById(@Headers() headers: any, @Param('id') id: string) {
    await this.validateRequest(headers, 'read:staff');
    return this.externalApiService.getStaffById(id);
  }

  // ==================== DEDUCTION ENDPOINTS ====================

  @Public()
  @Post('deductions')
  @ApiOperation({ summary: 'Create deduction for staff member' })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({ status: 201, description: 'Deduction created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Invalid API key or missing scope' })
  async createDeduction(
    @Headers() headers: any,
    @Body() dto: CreateExternalDeductionDto,
  ) {
    const apiKey = await this.validateRequest(headers, 'write:deductions');
    return this.externalApiService.createExternalDeduction(dto, apiKey.id);
  }

  @Public()
  @Get('deductions/:id')
  @ApiOperation({ summary: 'Get deduction status' })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({ status: 200, description: 'Deduction status retrieved' })
  @ApiResponse({ status: 404, description: 'Deduction not found' })
  async getDeductionStatus(@Headers() headers: any, @Param('id') id: string) {
    await this.validateRequest(headers, 'read:deductions');
    return this.externalApiService.getDeductionStatus(id);
  }

  @Public()
  @Delete('deductions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel pending deduction' })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({ status: 200, description: 'Deduction cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Deduction already processed' })
  async cancelDeduction(@Headers() headers: any, @Param('id') id: string) {
    await this.validateRequest(headers, 'write:deductions');
    return this.externalApiService.cancelDeduction(id);
  }

  // ==================== PAYROLL ENDPOINTS ====================

  @Public()
  @Get('payroll-periods')
  @ApiOperation({ summary: 'Get active payroll periods' })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({ status: 200, description: 'Payroll periods retrieved successfully' })
  async getPayrollPeriods(@Headers() headers: any) {
    await this.validateRequest(headers, 'read:payroll');
    return this.externalApiService.getPayrollPeriods();
  }

  // ==================== WEBHOOK ENDPOINTS ====================

  @Public()
  @Post('webhooks')
  @ApiOperation({ summary: 'Register webhook endpoint' })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
  @ApiResponse({ status: 201, description: 'Webhook registered successfully' })
  async createWebhook(@Headers() headers: any, @Body() dto: CreateWebhookDto) {
    const apiKey = await this.validateRequest(headers, 'manage:webhooks');
    return this.externalApiService.createWebhook(dto, apiKey.id);
  }
}