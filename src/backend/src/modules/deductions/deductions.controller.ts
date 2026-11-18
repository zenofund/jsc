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
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DeductionsService } from './deductions.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { Permissions } from '@common/decorators/permissions.decorator';

@ApiTags('Deductions')
@ApiBearerAuth()
@Controller('deductions')
@UseGuards(RolesGuard)
export class DeductionsController {
  constructor(private readonly deductionsService: DeductionsService) {}

  // ==================== GLOBAL DEDUCTIONS ====================

  @Post('global')
  @Permissions('staff.deduction.catalog.create')
  @ApiOperation({ summary: 'Create global deduction' })
  createGlobalDeduction(@Body() dto: any, @Request() req) {
    return this.deductionsService.createGlobalDeduction(dto, req.user.userId);
  }

  @Get('global')
  @Permissions('staff.deduction.catalog.read')
  @ApiOperation({ summary: 'Get all global deductions' })
  findAllGlobalDeductions(@Query() query: any) {
    return this.deductionsService.findAllGlobalDeductions(query);
  }

  @Patch('global/:id')
  @Permissions('staff.deduction.catalog.update')
  @ApiOperation({ summary: 'Update global deduction' })
  updateGlobalDeduction(@Param('id') id: string, @Body() dto: any, @Request() req) {
    return this.deductionsService.updateGlobalDeduction(id, dto, req.user.userId);
  }

  @Delete('global/:id')
  @Permissions('staff.deduction.catalog.delete')
  @ApiOperation({ summary: 'Delete global deduction' })
  removeGlobalDeduction(@Param('id') id: string, @Request() req) {
    return this.deductionsService.removeGlobalDeduction(id, req.user.userId);
  }

  // ==================== STAFF-SPECIFIC DEDUCTIONS ====================

  @Post('staff')
  @Permissions('staff.deduction.create')
  @ApiOperation({ summary: 'Create staff-specific deduction' })
  createStaffDeduction(@Body() dto: any, @Request() req) {
    return this.deductionsService.createStaffDeduction(dto, req.user.userId, req.user.role);
  }

  @Get('staff/all')
  @Permissions('staff.deduction.read')
  @ApiOperation({ summary: 'Get all staff deductions with pagination' })
  findAllStaffDeductions(@Query() query: any) {
    return this.deductionsService.findAllStaffDeductions(query);
  }

  @Get('staff/:staffId')
  @Permissions('staff.deduction.read')
  @ApiOperation({ summary: 'Get deductions for a specific staff member' })
  findStaffDeductions(@Param('staffId') staffId: string, @Query() query: any) {
    return this.deductionsService.findStaffDeductions(staffId, query);
  }

  @Patch('staff/bulk-status')
  @Permissions('staff.deduction.status.update')
  @ApiOperation({ summary: 'Bulk update status of staff deductions' })
  bulkUpdateStaffDeductionStatus(@Body() body: { ids: string[], status: string }, @Request() req) {
    return this.deductionsService.bulkUpdateStaffDeductionStatus(body.ids, body.status, req.user.userId);
  }

  @Patch('staff/:id')
  @Permissions('staff.deduction.update')
  @ApiOperation({ summary: 'Update staff-specific deduction' })
  updateStaffDeduction(@Param('id') id: string, @Body() dto: any, @Request() req) {
    if (
      dto && Object.prototype.hasOwnProperty.call(dto, 'status') &&
      !req.user.permissions?.includes('staff.deduction.status.update')
    ) {
      throw new ForbiddenException('You do not have permission to change deduction status');
    }
    return this.deductionsService.updateStaffDeduction(id, dto, req.user.userId);
  }

  @Delete('staff/:id')
  @Permissions('staff.deduction.delete')
  @ApiOperation({ summary: 'Delete staff-specific deduction' })
  removeStaffDeduction(@Param('id') id: string, @Request() req) {
    return this.deductionsService.removeStaffDeduction(id, req.user.userId);
  }
}
