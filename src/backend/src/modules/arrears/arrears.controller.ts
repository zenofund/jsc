import { Controller, Get, Post, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ArrearsService } from './arrears.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { Permissions } from '@common/decorators/permissions.decorator';

@ApiTags('Arrears')
@ApiBearerAuth()
@Controller('arrears')
@UseGuards(RolesGuard)
export class ArrearsController {
  constructor(private readonly arrearsService: ArrearsService) {}

  @Get('pending')
  @Permissions('arrears.read')
  @ApiOperation({ summary: 'Get all arrears and adjustments history' })
  getPendingArrears() {
    return this.arrearsService.getPendingArrears();
  }

  @Post('create')
  @Permissions('arrears.create')
  @ApiOperation({ summary: 'Create manual arrears/adjustment' })
  createArrears(@Body() body: any, @Request() req) {
    return this.arrearsService.createArrears(body, req.user.userId);
  }

  @Post('preview')
  @Permissions('arrears.preview')
  @ApiOperation({ summary: 'Preview calculated manual salary arrears' })
  previewManualArrears(@Body() body: any) {
    return this.arrearsService.previewManualSalaryArrears(body);
  }

  @Post(':id/delete')
  @Permissions('arrears.delete')
  @ApiOperation({ summary: 'Delete arrears' })
  deleteArrears(@Param('id') id: string, @Request() req) {
    return this.arrearsService.deleteArrears(id, req.user.userId);
  }

  @Post(':id/approve')
  @Permissions('arrears.approve')
  @ApiOperation({ summary: 'Approve arrears' })
  approveArrears(@Param('id') id: string, @Request() req) {
    return this.arrearsService.approveArrears(id, req.user.userId);
  }

  @Post(':id/reject')
  @Permissions('arrears.reject')
  @ApiOperation({ summary: 'Reject arrears' })
  rejectArrears(@Param('id') id: string, @Body() body: { reason?: string }, @Request() req) {
    return this.arrearsService.rejectArrears(id, req.user.userId, body?.reason);
  }

  @Post('bulk-approve')
  @Permissions('arrears.bulk_approve')
  @ApiOperation({ summary: 'Bulk approve arrears' })
  bulkApproveArrears(@Body() body: { arrearsIds?: string[] }, @Request() req) {
    return this.arrearsService.bulkApproveArrears(body?.arrearsIds || [], req.user.userId);
  }

  @Post('bulk-reject')
  @Permissions('arrears.bulk_reject')
  @ApiOperation({ summary: 'Bulk reject arrears' })
  bulkRejectArrears(@Body() body: { arrearsIds?: string[]; reason?: string }, @Request() req) {
    return this.arrearsService.bulkRejectArrears(body?.arrearsIds || [], req.user.userId, body?.reason);
  }

  @Post('bulk-merge')
  @Permissions('arrears.bulk_merge')
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
  @Permissions('arrears.merge')
  @ApiOperation({ summary: 'Merge arrears to payroll batch' })
  mergeArrearsToPayroll(@Param('id') id: string, @Body() body: { payrollBatchId: string }, @Request() req) {
    return this.arrearsService.mergeArrearsToPayroll(id, body.payrollBatchId, req.user.userId);
  }

  @Post(':id/recalculate')
  @Permissions('arrears.recalculate')
  @ApiOperation({ summary: 'Recalculate arrears amount' })
  recalculateArrears(@Param('id') id: string, @Request() req) {
    return this.arrearsService.recalculateArrears(id, req.user.userId);
  }
}
