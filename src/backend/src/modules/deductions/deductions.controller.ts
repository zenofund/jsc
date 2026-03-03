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
import { DeductionsService } from './deductions.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Deductions')
@ApiBearerAuth()
@Controller('deductions')
@UseGuards(RolesGuard)
export class DeductionsController {
  constructor(private readonly deductionsService: DeductionsService) {}

  // ==================== GLOBAL DEDUCTIONS ====================

  @Post('global')
  @Roles('admin', 'hr_manager')
  @ApiOperation({ summary: 'Create global deduction' })
  createGlobalDeduction(@Body() dto: any, @Request() req) {
    return this.deductionsService.createGlobalDeduction(dto, req.user.userId);
  }

  @Get('global')
  @ApiOperation({ summary: 'Get all global deductions' })
  findAllGlobalDeductions(@Query() query: any) {
    return this.deductionsService.findAllGlobalDeductions(query);
  }

  @Patch('global/:id')
  @Roles('admin', 'hr_manager')
  @ApiOperation({ summary: 'Update global deduction' })
  updateGlobalDeduction(@Param('id') id: string, @Body() dto: any, @Request() req) {
    return this.deductionsService.updateGlobalDeduction(id, dto, req.user.userId);
  }

  @Delete('global/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate global deduction' })
  removeGlobalDeduction(@Param('id') id: string, @Request() req) {
    return this.deductionsService.removeGlobalDeduction(id, req.user.userId);
  }

  // ==================== STAFF-SPECIFIC DEDUCTIONS ====================

  @Post('staff')
  @Roles('admin', 'payroll_officer', 'hr_manager', 'payroll_loader')
  @ApiOperation({ summary: 'Create staff-specific deduction' })
  createStaffDeduction(@Body() dto: any, @Request() req) {
    return this.deductionsService.createStaffDeduction(dto, req.user.userId, req.user.role);
  }

  @Get('staff/all')
  @Roles('admin', 'payroll_officer', 'payroll_loader')
  @ApiOperation({ summary: 'Get all staff deductions with pagination' })
  findAllStaffDeductions(@Query() query: any) {
    return this.deductionsService.findAllStaffDeductions(query);
  }

  @Get('staff/:staffId')
  @ApiOperation({ summary: 'Get deductions for a specific staff member' })
  findStaffDeductions(@Param('staffId') staffId: string, @Query() query: any) {
    return this.deductionsService.findStaffDeductions(staffId, query);
  }

  @Patch('staff/bulk-status')
  @Roles('admin', 'payroll_officer', 'hr_manager')
  @ApiOperation({ summary: 'Bulk update status of staff deductions' })
  bulkUpdateStaffDeductionStatus(@Body() body: { ids: string[], status: string }, @Request() req) {
    return this.deductionsService.bulkUpdateStaffDeductionStatus(body.ids, body.status, req.user.userId);
  }

  @Patch('staff/:id')
  @Roles('admin', 'payroll_officer', 'hr_manager', 'payroll_loader')
  @ApiOperation({ summary: 'Update staff-specific deduction' })
  updateStaffDeduction(@Param('id') id: string, @Body() dto: any, @Request() req) {
    return this.deductionsService.updateStaffDeduction(id, dto, req.user.userId);
  }

  @Delete('staff/:id')
  @Roles('admin', 'payroll_officer', 'hr_manager', 'payroll_loader')
  @ApiOperation({ summary: 'Deactivate staff-specific deduction' })
  removeStaffDeduction(@Param('id') id: string, @Request() req) {
    return this.deductionsService.removeStaffDeduction(id, req.user.userId);
  }
}
