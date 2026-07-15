import { Controller, Get, Post, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ArrearsService } from './arrears.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Arrears')
@ApiBearerAuth()
@Controller('arrears')
@UseGuards(RolesGuard)
export class ArrearsController {
  constructor(private readonly arrearsService: ArrearsService) {}

  @Get('pending')
  @Roles('admin', 'payroll_officer', 'payroll_manager', 'hr_manager', 'payroll_loader')
  @ApiOperation({ summary: 'Get all arrears and adjustments history' })
  getPendingArrears() {
    return this.arrearsService.getPendingArrears();
  }

  @Post('create')
  @Roles('admin', 'payroll_officer', 'payroll_manager', 'hr_manager')
  @ApiOperation({ summary: 'Create manual arrears/adjustment' })
  createArrears(@Body() body: any, @Request() req) {
    return this.arrearsService.createArrears(body, req.user.userId);
  }

  @Post(':id/delete')
  @Roles('admin', 'payroll_officer', 'payroll_manager', 'hr_manager')
  @ApiOperation({ summary: 'Delete arrears' })
  deleteArrears(@Param('id') id: string, @Request() req) {
    return this.arrearsService.deleteArrears(id, req.user.userId);
  }

  @Post(':id/approve')
  @Roles('admin', 'payroll_officer')
  @ApiOperation({ summary: 'Approve arrears' })
  approveArrears(@Param('id') id: string, @Request() req) {
    return this.arrearsService.approveArrears(id, req.user.userId);
  }

  @Post(':id/reject')
  @Roles('admin', 'payroll_officer')
  @ApiOperation({ summary: 'Reject arrears' })
  rejectArrears(@Param('id') id: string, @Body() body: { reason?: string }, @Request() req) {
    return this.arrearsService.rejectArrears(id, req.user.userId, body?.reason);
  }

  @Post('bulk-approve')
  @Roles('admin', 'payroll_officer')
  @ApiOperation({ summary: 'Bulk approve arrears' })
  bulkApproveArrears(@Body() body: { arrearsIds?: string[] }, @Request() req) {
    return this.arrearsService.bulkApproveArrears(body?.arrearsIds || [], req.user.userId);
  }

  @Post('bulk-reject')
  @Roles('admin', 'payroll_officer')
  @ApiOperation({ summary: 'Bulk reject arrears' })
  bulkRejectArrears(@Body() body: { arrearsIds?: string[]; reason?: string }, @Request() req) {
    return this.arrearsService.bulkRejectArrears(body?.arrearsIds || [], req.user.userId, body?.reason);
  }

  @Post('bulk-merge')
  @Roles('admin', 'payroll_officer', 'payroll_manager', 'hr_manager')
  @ApiOperation({ summary: 'Bulk merge arrears to payroll batch' })
  bulkMergeArrears(
    @Body() body: { arrearsIds?: string[]; payrollBatchId: string },
    @Request() req,
  ) {
    return this.arrearsService.bulkMergeArrearsToPayroll(
      body?.arrearsIds || [],
      body?.payrollBatchId,
      req.user.userId,
    );
  }

  @Post(':id/merge')
  @Roles('admin', 'payroll_officer', 'payroll_manager', 'hr_manager')
  @ApiOperation({ summary: 'Merge arrears to payroll batch' })
  mergeArrearsToPayroll(@Param('id') id: string, @Body() body: { payrollBatchId: string }, @Request() req) {
    return this.arrearsService.mergeArrearsToPayroll(id, body.payrollBatchId, req.user.userId);
  }

  @Post(':id/recalculate')
  @Roles('admin', 'payroll_officer', 'payroll_manager', 'hr_manager')
  @ApiOperation({ summary: 'Recalculate arrears amount' })
  recalculateArrears(@Param('id') id: string, @Request() req) {
    return this.arrearsService.recalculateArrears(id, req.user.userId);
  }
}
