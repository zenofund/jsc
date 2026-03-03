import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AllowancesService } from './allowances.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Allowances')
@ApiBearerAuth()
@Controller('allowances')
@UseGuards(RolesGuard)
export class AllowancesController {
  constructor(private readonly allowancesService: AllowancesService) {}

  // ==================== GLOBAL ALLOWANCES ====================

  @Post('global')
  @Roles('admin', 'hr_manager')
  @ApiOperation({ summary: 'Create global allowance' })
  createGlobalAllowance(@Body() dto: any, @Request() req) {
    return this.allowancesService.createGlobalAllowance(dto, req.user.userId);
  }

  @Get('global')
  @ApiOperation({ summary: 'Get all global allowances' })
  findAllGlobalAllowances(@Query() query: any) {
    return this.allowancesService.findAllGlobalAllowances(query);
  }

  @Patch('global/:id')
  @Roles('admin', 'hr_manager')
  @ApiOperation({ summary: 'Update global allowance' })
  updateGlobalAllowance(@Param('id') id: string, @Body() dto: any, @Request() req) {
    return this.allowancesService.updateGlobalAllowance(id, dto, req.user.userId);
  }

  @Delete('global/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate global allowance' })
  removeGlobalAllowance(@Param('id') id: string, @Request() req) {
    return this.allowancesService.removeGlobalAllowance(id, req.user.userId);
  }

  // ==================== STAFF-SPECIFIC ALLOWANCES ====================

  @Post('staff')
  @Roles('admin', 'payroll_officer', 'hr_manager', 'payroll_loader')
  @ApiOperation({ summary: 'Create staff-specific allowance' })
  createStaffAllowance(@Body() dto: any, @Request() req) {
    return this.allowancesService.createStaffAllowance(dto, req.user.userId, req.user.role);
  }

  @Get('staff/all')
  @Roles('admin', 'payroll_officer', 'payroll_loader')
  @ApiOperation({ summary: 'Get all staff allowances with pagination' })
  findAllStaffAllowances(@Query() query: any) {
    return this.allowancesService.findAllStaffAllowances(query);
  }

  @Get('staff/:staffId')
  @ApiOperation({ summary: 'Get allowances for a specific staff member' })
  findStaffAllowances(@Param('staffId') staffId: string, @Query() query: any) {
    return this.allowancesService.findStaffAllowances(staffId, query);
  }

  @Patch('staff/bulk-status')
  @Roles('admin', 'payroll_officer', 'hr_manager')
  @ApiOperation({ summary: 'Bulk update status of staff allowances' })
  bulkUpdateStaffAllowanceStatus(@Body() body: { ids: string[], status: string }, @Request() req) {
    return this.allowancesService.bulkUpdateStaffAllowanceStatus(body.ids, body.status, req.user.userId);
  }

  @Patch('staff/:id')
  @Roles('admin', 'payroll_officer', 'hr_manager', 'payroll_loader')
  @ApiOperation({ summary: 'Update staff-specific allowance' })
  updateStaffAllowance(@Param('id') id: string, @Body() dto: any, @Request() req) {
    return this.allowancesService.updateStaffAllowance(id, dto, req.user.userId);
  }

  @Delete('staff/:id')
  @Roles('admin', 'payroll_officer', 'hr_manager', 'payroll_loader')
  @ApiOperation({ summary: 'Deactivate staff-specific allowance' })
  removeStaffAllowance(@Param('id') id: string, @Request() req) {
    return this.allowancesService.removeStaffAllowance(id, req.user.userId);
  }
}
