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
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { CreatePayrollBatchDto } from './dto/create-payroll-batch.dto';
import { ApprovePayrollDto } from './dto/approve-payroll.dto';
import { RolesGuard } from '@common/guards/roles.guard';
import { Permissions } from '@common/decorators/permissions.decorator';
import { SkipAudit } from '../../common/decorators/skip-audit.decorator';

@ApiTags('Payroll')
@ApiBearerAuth()
@Controller('payroll')
@UseGuards(RolesGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('batches')
  @Permissions('payroll.batch.create')
  @ApiOperation({ summary: 'Create new payroll batch' })
  @ApiResponse({ status: 201, description: 'Payroll batch created successfully' })
  createBatch(@Body() createDto: CreatePayrollBatchDto, @Request() req) {
    return this.payrollService.createBatch(createDto, req.user.userId);
  }

  @Post('batches/:id/generate-lines')
  @Permissions('payroll.batch.generate')
  @ApiOperation({ summary: 'Generate payroll lines for all eligible staff (BULK)' })
  @ApiResponse({ status: 200, description: 'Payroll lines generated successfully' })
  generateLines(@Param('id') id: string, @Request() req) {
    return this.payrollService.generatePayrollLines(id, req.user.userId);
  }

  @Post('batches/:id/submit')
  @Permissions('payroll.batch.submit')
  @SkipAudit()
  @ApiOperation({ summary: 'Submit batch for approval workflow' })
  @ApiResponse({ status: 200, description: 'Batch submitted successfully' })
  submitForApproval(@Param('id') id: string, @Request() req) {
    if (!req?.user?.userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.payrollService.submitForApproval(id, req.user.userId);
  }

  @Post('batches/:id/approve')
  @Permissions('payroll.batch.approve')
  @SkipAudit()
  @ApiOperation({ summary: 'Approve or reject payroll batch' })
  @ApiResponse({ status: 200, description: 'Batch approval action completed' })
  approveOrReject(@Param('id') id: string, @Body() approveDto: ApprovePayrollDto, @Request() req) {
    return this.payrollService.approveOrReject(id, approveDto, req.user.userId);
  }

  @Post('batches/:id/lock')
  @Permissions('payroll.batch.lock')
  @ApiOperation({ summary: 'Lock approved payroll batch' })
  @ApiResponse({ status: 200, description: 'Batch locked successfully' })
  lockBatch(@Param('id') id: string, @Request() req) {
    return this.payrollService.lockBatch(id, req.user.userId);
  }

  @Get('pending-payments')
  @Permissions('payroll.payment.read')
  @ApiOperation({ summary: 'Get pending payments' })
  @ApiResponse({ status: 200, description: 'List of pending payments' })
  getPendingPayments() {
    return this.payrollService.getPendingPayments();
  }

  @Post('batches/:id/execute-payment')
  @Permissions('payroll.payment.execute')
  @SkipAudit()
  @ApiOperation({ summary: 'Execute payment for a payroll batch' })
  @ApiResponse({ status: 200, description: 'Payment executed successfully' })
  executePayment(@Param('id') id: string, @Body() body: any, @Request() req) {
    const reference = body?.reference || body?.paymentReference || 'N/A';
    return this.payrollService.executePayment(id, reference, req.user.userId);
  }

  @Get('batches')
  @Permissions('payroll.batch.read')
  @ApiOperation({ summary: 'Get all payroll batches with filters' })
  findAllBatches(@Query() query: any) {
    return this.payrollService.findAll(query);
  }

  @Get('batches/:id')
  @Permissions('payroll.batch.read')
  @ApiOperation({ summary: 'Get payroll batch by ID' })
  @ApiResponse({ status: 200, description: 'Batch found' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  findOneBatch(@Param('id') id: string) {
    return this.payrollService.findOne(id);
  }

  @Get('batches/:id/lines')
  @Permissions('payroll.batch.read')
  @ApiOperation({ summary: 'Get payroll lines for a batch' })
  getPayrollLines(@Param('id') id: string, @Query() query: any) {
    return this.payrollService.getPayrollLines(id, query);
  }

  @Get('batches/:id/payment-trace')
  @Permissions('payroll.payment.read')
  @ApiOperation({ summary: 'Get payment trace for a payroll batch' })
  getPaymentTrace(@Param('id') id: string) {
    return this.payrollService.getPaymentTrace(id);
  }

  @Get('payslips/staff/:staffId')
  @Permissions('payslip.read')
  @ApiOperation({ summary: 'Get all payslips for a staff member' })
  getStaffPayslips(@Param('staffId') staffId: string, @Query('payrollMonth') payrollMonth?: string) {
    return this.payrollService.getStaffPayslips(staffId, payrollMonth);
  }

  @Get('payslips/batch/:batchId')
  @Permissions('payslip.read')
  @ApiOperation({ summary: 'Get all payslips for a batch' })
  getBatchPayslips(@Param('batchId') batchId: string, @Query('payrollMonth') payrollMonth?: string) {
    return this.payrollService.getBatchPayslips(batchId, payrollMonth);
  }

  @Get('approvals/history')
  @Permissions('payroll.batch.read')
  @ApiOperation({ summary: 'Get approval actions history for current user' })
  getApproverHistory(@Request() req) {
    return this.payrollService.getApproverHistory(req.user.userId, req.user.role);
  }

  @Delete('batches/:id')
  @Permissions('payroll.batch.delete')
  @ApiOperation({ summary: 'Delete draft payroll batch' })
  @ApiResponse({ status: 200, description: 'Batch deleted successfully' })
  removeBatch(@Param('id') id: string, @Request() req) {
    return this.payrollService.remove(id, req.user.userId);
  }
}
