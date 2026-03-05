import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LoansService } from './loans.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import {
  CreateLoanTypeDto,
  UpdateLoanTypeDto,
  CreateLoanApplicationDto,
  UpdateLoanApplicationDto,
  ApproveLoanDto,
  DisburseLoanDto,
  RecordRepaymentDto,
  CreateGuarantorDto,
  UpdateGuarantorDto,
  LoanStatus,
} from './dto/loan.dto';

@ApiTags('Loans')
@ApiBearerAuth()
@Controller('loans')
@UseGuards(RolesGuard)
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  // ==================== LOAN TYPES ====================

  @Post('types')
  @ApiOperation({ summary: 'Create loan type' })
  createLoanType(@Body() dto: CreateLoanTypeDto, @Request() req) {
    return this.loansService.createLoanType(dto, req.user.userId);
  }

  @Get('types')
  @ApiOperation({ summary: 'Get all loan types' })
  findAllLoanTypes(
    @Query('status') status?: string,
    @Query('cooperative_id') cooperativeId?: string,
  ) {
    return this.loansService.findAllLoanTypes({ status, cooperativeId });
  }

  @Get('types/:id')
  @ApiOperation({ summary: 'Get loan type by ID' })
  findOneLoanType(@Param('id') id: string) {
    return this.loansService.findOneLoanType(id);
  }

  @Put('types/:id')
  @ApiOperation({ summary: 'Update loan type' })
  updateLoanType(@Param('id') id: string, @Body() dto: UpdateLoanTypeDto, @Request() req) {
    return this.loansService.updateLoanType(id, dto, req.user.userId);
  }

  @Delete('types/:id')
  @ApiOperation({ summary: 'Delete loan type' })
  deleteLoanType(@Param('id') id: string, @Request() req) {
    return this.loansService.deleteLoanType(id, req.user.userId);
  }

  // ==================== LOAN APPLICATIONS ====================

  @Post('applications')
  @ApiOperation({ summary: 'Create loan application' })
  createLoanApplication(@Body() dto: CreateLoanApplicationDto, @Request() req) {
    return this.loansService.createLoanApplication(dto, req.user.userId);
  }

  @Get('applications')
  @ApiOperation({ summary: 'Get all loan applications' })
  findAllLoanApplications(
    @Query('staff_id') staffId?: string,
    @Query('loan_type_id') loanTypeId?: string,
    @Query('status') status?: string,
  ) {
    return this.loansService.findAllLoanApplications({
      staffId,
      loanTypeId,
      status,
    });
  }

  @Get('applications/:id')
  @ApiOperation({ summary: 'Get loan application by ID' })
  findOneLoanApplication(@Param('id') id: string) {
    return this.loansService.findOneLoanApplication(id);
  }

  @Put('applications/:id')
  @ApiOperation({ summary: 'Update loan application' })
  updateLoanApplication(
    @Param('id') id: string,
    @Body() dto: UpdateLoanApplicationDto,
    @Request() req,
  ) {
    return this.loansService.updateLoanApplication(id, dto, req.user.userId);
  }

  @Put('applications/:id/submit')
  @ApiOperation({ summary: 'Submit loan application' })
  submitLoanApplication(@Param('id') id: string, @Request() req) {
    return this.loansService.submitLoanApplication(id, req.user.userId);
  }

  @Patch('applications/:id/approve')
  @Roles('admin', 'payroll_officer')
  @ApiOperation({ summary: 'Approve loan application' })
  approveLoanApplication(
    @Param('id') id: string,
    @Body() dto: ApproveLoanDto,
    @Request() req,
  ) {
    return this.loansService.approveLoanApplication(id, dto, req.user.userId);
  }

  @Patch('applications/:id/reject')
  @Roles('admin', 'payroll_officer')
  @ApiOperation({ summary: 'Reject loan application' })
  rejectLoanApplication(
    @Param('id') id: string,
    @Body('remarks') remarks: string,
    @Request() req,
  ) {
    return this.loansService.rejectLoanApplication(id, remarks, req.user.userId);
  }

  @Delete('applications/:id')
  @ApiOperation({ summary: 'Delete loan application (draft only)' })
  deleteLoanApplication(@Param('id') id: string, @Request() req) {
    return this.loansService.deleteLoanApplication(id, req.user.userId);
  }

  // ==================== GUARANTORS ====================

  @Post('guarantors')
  @ApiOperation({ summary: 'Add guarantor to loan application' })
  addGuarantor(@Body() dto: CreateGuarantorDto, @Request() req) {
    return this.loansService.addGuarantor(dto, req.user.userId);
  }

  @Get('guarantors')
  @ApiOperation({ summary: 'Get guarantors' })
  findGuarantors(
    @Query('loan_application_id') loanApplicationId?: string,
    @Query('guarantor_staff_id') guarantorStaffId?: string,
  ) {
    return this.loansService.findGuarantors({
      loanApplicationId,
      guarantorStaffId,
    });
  }

  @Get('guarantors/:id')
  @ApiOperation({ summary: 'Get guarantor by ID' })
  findOneGuarantor(@Param('id') id: string) {
    return this.loansService.findOneGuarantor(id);
  }

  @Put('guarantors/:id')
  @ApiOperation({ summary: 'Update guarantor (respond to request)' })
  updateGuarantor(
    @Param('id') id: string,
    @Body() dto: UpdateGuarantorDto,
    @Request() req,
  ) {
    return this.loansService.updateGuarantor(id, dto, req.user.userId);
  }

  @Delete('guarantors/:id')
  @ApiOperation({ summary: 'Remove guarantor' })
  removeGuarantor(@Param('id') id: string, @Request() req) {
    return this.loansService.removeGuarantor(id, req.user.userId);
  }

  // ==================== DISBURSEMENTS ====================

  @Post('disbursements')
  @ApiOperation({ summary: 'Disburse loan' })
  disburseLoan(@Body() dto: DisburseLoanDto, @Request() req) {
    return this.loansService.disburseLoan(dto, req.user.userId);
  }

  @Get('disbursements')
  @ApiOperation({ summary: 'Get all disbursements' })
  findAllDisbursements(
    @Query('staff_id') staffId?: string,
    @Query('status') status?: string,
  ) {
    return this.loansService.findAllDisbursements({
      staffId,
      status,
    });
  }

  @Get('disbursements/:id')
  @ApiOperation({ summary: 'Get disbursement by ID' })
  findOneDisbursement(@Param('id') id: string) {
    return this.loansService.findOneDisbursement(id);
  }

  @Get('disbursements/:id/repayments')
  @ApiOperation({ summary: 'Get repayment history for a disbursement' })
  getDisbursementRepayments(@Param('id') id: string) {
    return this.loansService.getDisbursementRepayments(id);
  }

  @Put('disbursements/:id/mark-completed')
  @ApiOperation({ summary: 'Mark disbursement as completed' })
  completeDisbursement(@Param('id') id: string, @Request() req) {
    return this.loansService.completeDisbursement(id, req.user.userId);
  }

  // ==================== REPAYMENTS ====================

  @Post('repayments')
  @ApiOperation({ summary: 'Record loan repayment' })
  recordRepayment(@Body() dto: RecordRepaymentDto, @Request() req) {
    return this.loansService.recordRepayment(dto, req.user.userId);
  }

  @Get('repayments')
  @ApiOperation({ summary: 'Get all repayments' })
  findAllRepayments(
    @Query('disbursement_id') disbursementId?: string,
    @Query('staff_id') staffId?: string,
  ) {
    return this.loansService.findAllRepayments({
      disbursementId,
      staffId,
    });
  }

  @Get('repayments/:id')
  @ApiOperation({ summary: 'Get repayment by ID' })
  findOneRepayment(@Param('id') id: string) {
    return this.loansService.findOneRepayment(id);
  }

  // ==================== STATS ====================

  @Get('stats/overview')
  @ApiOperation({ summary: 'Get loan statistics overview' })
  getLoanStats() {
    return this.loansService.getLoanStats();
  }

  @Get('stats/staff/:staffId')
  @ApiOperation({ summary: 'Get loan statistics for a staff member' })
  getStaffLoanStats(@Param('staffId') staffId: string) {
    return this.loansService.getStaffLoanStats(staffId);
  }
}
