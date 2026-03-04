import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { BankService } from './bank.service';
import {
  CreateBankAccountDto,
  UpdateBankAccountDto,
  CreatePaymentBatchDto,
  UpdatePaymentBatchDto,
  ProcessPaymentDto,
  ApprovePaymentDto,
  CreateBankStatementDto,
  ParseStatementDto,
  CreateReconciliationDto,
  ManualMatchDto,
  CreateExceptionDto,
  ResolveExceptionDto,
  EscalateExceptionDto,
} from './dto/bank.dto';

@ApiTags('Bank Payments')
@ApiBearerAuth()
@Controller('bank')
@UseGuards(RolesGuard)
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Get('supported-banks')
  @ApiOperation({ summary: 'Get list of supported banks' })
  getSupportedBanks() {
    return this.bankService.getSupportedBanks();
  }

  // ==================== BANK ACCOUNTS ====================

  @Post('accounts')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Create bank account' })
  createBankAccount(@Body() dto: CreateBankAccountDto, @Request() req) {
    return this.bankService.createBankAccount(dto, req.user.userId);
  }

  @Get('accounts')
  @ApiOperation({ summary: 'Get all bank accounts' })
  findAllBankAccounts(@Query('is_active') isActive?: string) {
    if (isActive === undefined) {
      return this.bankService.findAllBankAccounts();
    }
    return this.bankService.findAllBankAccounts(isActive === 'true');
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get bank account by ID' })
  findOneBankAccount(@Param('id') id: string) {
    return this.bankService.findOneBankAccount(id);
  }

  @Put('accounts/:id')
  @Roles('admin', 'super_admin', 'payroll_manager')
  @ApiOperation({ summary: 'Update bank account' })
  updateBankAccount(
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountDto,
    @Request() req,
  ) {
    return this.bankService.updateBankAccount(id, dto, req.user.userId);
  }

  @Delete('accounts/:id')
  @Roles('admin', 'super_admin', 'payroll_manager')
  @ApiOperation({ summary: 'Delete bank account' })
  deleteBankAccount(@Param('id') id: string, @Request() req) {
    return this.bankService.deleteBankAccount(id, req.user.userId);
  }

  // ==================== PAYMENT BATCHES ====================

  @Post('payment-batches')
  @ApiOperation({ summary: 'Create payment batch from payroll' })
  createPaymentBatch(@Body() dto: CreatePaymentBatchDto, @Request() req) {
    return this.bankService.createPaymentBatch(dto, req.user.userId);
  }

  @Get('payment-batches')
  @ApiOperation({ summary: 'Get all payment batches' })
  findAllPaymentBatches() {
    return this.bankService.findAllPaymentBatches();
  }

  @Get('payment-batches/:id')
  @ApiOperation({ summary: 'Get payment batch by ID' })
  findOnePaymentBatch(@Param('id') id: string) {
    return this.bankService.findOnePaymentBatch(id);
  }

  @Get('payment-batches/:id/transactions')
  @ApiOperation({ summary: 'Get transactions for payment batch' })
  getPaymentBatchTransactions(@Param('id') id: string) {
    return this.bankService.getPaymentBatchTransactions(id);
  }

  @Put('payment-batches/:id/status')
  @ApiOperation({ summary: 'Update payment batch status' })
  updatePaymentBatchStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentBatchDto,
    @Request() req,
  ) {
    return this.bankService.updatePaymentBatchStatus(id, dto, req.user.userId);
  }

  @Post('payment-batches/:id/generate-file')
  @ApiOperation({ summary: 'Generate payment file' })
  generatePaymentFile(@Param('id') id: string, @Request() req) {
    return this.bankService.generatePaymentFile(id, req.user.userId);
  }

  @Post('payment-batches/:id/process')
  @Roles('admin', 'cashier')
  @ApiOperation({ summary: 'Process payment batch' })
  processPayment(
    @Param('id') id: string,
    @Body() dto: ProcessPaymentDto,
    @Request() req,
  ) {
    return this.bankService.processPayment(id, dto, req.user.userId);
  }

  @Post('payment-batches/:id/approve')
  @ApiOperation({ summary: 'Approve payment batch' })
  approvePaymentBatch(
    @Param('id') id: string,
    @Body() dto: ApprovePaymentDto,
    @Request() req,
  ) {
    return this.bankService.approvePaymentBatch(id, dto, req.user.userId);
  }

  @Post('payment-batches/:id/execute')
  @ApiOperation({ summary: 'Execute payment batch' })
  executePaymentBatch(@Param('id') id: string, @Body() body: { reference: string }, @Request() req) {
    return this.bankService.executePaymentBatch(id, body.reference, req.user.userId);
  }

  @Post('payment-batches/:id/confirm')
  @ApiOperation({ summary: 'Confirm payment batch completion' })
  confirmPaymentBatch(@Param('id') id: string, @Request() req) {
    return this.bankService.confirmPaymentBatch(id, req.user.userId);
  }

  @Post('transactions/:id/retry')
  @ApiOperation({ summary: 'Retry failed transaction' })
  retryFailedTransaction(@Param('id') id: string, @Request() req) {
    return this.bankService.retryFailedTransaction(id, req.user.userId);
  }

  // ==================== BANK STATEMENTS ====================

  @Post('statements')
  @ApiOperation({ summary: 'Upload bank statement' })
  uploadBankStatement(@Body() dto: CreateBankStatementDto, @Request() req) {
    return this.bankService.uploadBankStatement(dto, req.user.userId);
  }

  @Get('statements')
  @ApiOperation({ summary: 'Get all bank statements' })
  findAllBankStatements() {
    return this.bankService.findAllBankStatements();
  }

  @Get('statements/:id')
  @ApiOperation({ summary: 'Get bank statement by ID' })
  findOneBankStatement(@Param('id') id: string) {
    return this.bankService.findOneBankStatement(id);
  }

  @Get('statements/:id/lines')
  @ApiOperation({ summary: 'Get bank statement lines' })
  getStatementLines(@Param('id') id: string) {
    return this.bankService.getStatementLines(id);
  }

  @Post('statements/:id/parse')
  @ApiOperation({ summary: 'Parse bank statement CSV' })
  parseStatement(
    @Param('id') id: string,
    @Body() dto: ParseStatementDto,
    @Request() req,
  ) {
    return this.bankService.parseStatement(id, dto, req.user.userId);
  }

  // ==================== RECONCILIATION ====================

  @Post('reconciliations')
  @ApiOperation({ summary: 'Create reconciliation' })
  createReconciliation(@Body() dto: CreateReconciliationDto, @Request() req) {
    return this.bankService.createReconciliation(dto, req.user.userId);
  }

  @Get('reconciliations')
  @ApiOperation({ summary: 'Get all reconciliations' })
  findAllReconciliations() {
    return this.bankService.findAllReconciliations();
  }

  @Get('reconciliations/:id')
  @ApiOperation({ summary: 'Get reconciliation by ID' })
  findOneReconciliation(@Param('id') id: string) {
    return this.bankService.findOneReconciliation(id);
  }

  @Post('reconciliations/:id/auto-match')
  @ApiOperation({ summary: 'Auto-match transactions' })
  autoMatchTransactions(@Param('id') id: string, @Request() req) {
    return this.bankService.autoMatchTransactions(id, req.user.userId);
  }

  @Post('reconciliations/manual-match')
  @ApiOperation({ summary: 'Manually match transaction' })
  manualMatchTransaction(@Body() dto: ManualMatchDto, @Request() req) {
    return this.bankService.manualMatchTransaction(dto, req.user.userId);
  }

  // ==================== EXCEPTIONS ====================

  @Post('exceptions')
  @ApiOperation({ summary: 'Create payment exception' })
  createException(@Body() dto: CreateExceptionDto, @Request() req) {
    return this.bankService.createException(dto, req.user.userId);
  }

  @Get('exceptions')
  @ApiOperation({ summary: 'Get all exceptions' })
  findAllExceptions() {
    return this.bankService.findAllExceptions();
  }

  @Get('exceptions/:id')
  @ApiOperation({ summary: 'Get exception by ID' })
  findOneException(@Param('id') id: string) {
    return this.bankService.findOneException(id);
  }

  @Put('exceptions/:id/resolve')
  @ApiOperation({ summary: 'Resolve exception' })
  resolveException(
    @Param('id') id: string,
    @Body() dto: ResolveExceptionDto,
    @Request() req,
  ) {
    return this.bankService.resolveException(id, dto, req.user.userId);
  }

  @Put('exceptions/:id/escalate')
  @ApiOperation({ summary: 'Escalate exception' })
  escalateException(
    @Param('id') id: string,
    @Body() dto: EscalateExceptionDto,
    @Request() req,
  ) {
    return this.bankService.escalateException(id, dto, req.user.userId);
  }

  // ==================== STATISTICS ====================

  @Get('stats/dashboard')
  @ApiOperation({ summary: 'Get payment statistics dashboard' })
  getDashboardStats() {
    return this.bankService.getDashboardStats();
  }
}
