import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
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

@Injectable()
export class BankService {
  private readonly logger = new Logger(BankService.name);

  // Nigerian Bank Sort Codes (CBN Codes)
  private readonly BANK_SORT_CODES: Record<string, string> = {
    'access bank': '044',
    'access bank (diamond)': '063',
    'alby': '000', // MFB placeholder
    'alat by wema': '035',
    'aso savings and loans': '401',
    'bowen microfinance bank': '50931',
    'cemcs microfinance bank': '50823',
    'citibank nigeria': '023',
    'coronation merchant bank': '559',
    'ecobank nigeria': '050',
    'ekondo microfinance bank': '562',
    'fbnquest merchant bank': '562',
    'fidelity bank': '070',
    'first bank of nigeria': '011',
    'first city monument bank': '214',
    'fcmb': '214',
    'globus bank': '00103',
    'guaranty trust bank': '058',
    'gtbank': '058',
    'hackman microfinance bank': '51251',
    'hasal microfinance bank': '50383',
    'heritage bank': '030',
    'jaiz bank': '301',
    'keystone bank': '082',
    'kuda bank': '50211',
    'links microfinance bank': '50549',
    'lotus bank': '303',
    'mayfair microfinance bank': '50563',
    'mint finex mfb': '50304',
    'moniepoint microfinance bank': '50515',
    'opay': '100004',
    'palmpay': '100033',
    'parallex bank': '526',
    'polaris bank': '076',
    'providus bank': '101',
    'rubies mfb': '125',
    'sparkle microfinance bank': '51310',
    'stanbic ibtc bank': '221',
    'standard chartered bank': '068',
    'sterling bank': '232',
    'suntrust bank': '100',
    'taj bank': '302',
    'tangerine money': '51269',
    'titan trust bank': '102',
    'union bank of nigeria': '032',
    'united bank for africa': '033',
    'uba': '033',
    'unity bank': '215',
    'vfd microfinance bank': '566',
    'wema bank': '035',
    'zenith bank': '057',
  };

  constructor(private databaseService: DatabaseService) {}
  
  async onModuleInit() {
    await this.ensurePaymentTransactionsSchema();
    await this.ensurePerformanceIndexes();
  }
  
  private async ensurePaymentTransactionsSchema() {
    try {
      await this.databaseService.query(`
        ALTER TABLE payment_transactions 
        ADD COLUMN IF NOT EXISTS bank_response_code VARCHAR(10)
      `);
      await this.databaseService.query(`
        ALTER TABLE payment_transactions 
        ADD COLUMN IF NOT EXISTS bank_response_message TEXT
      `);
      await this.databaseService.query(`
        ALTER TABLE payment_transactions 
        ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100)
      `);
    } catch (error: any) {
      this.logger.warn(`ensurePaymentTransactionsSchema failed: ${error?.message}`);
    }
  }

  private async ensurePerformanceIndexes() {
    try {
      await this.databaseService.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_batch_status
        ON payment_transactions (payment_batch_id, status)
      `);
      await this.databaseService.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_batch_staff
        ON payment_transactions (payment_batch_id, staff_number)
      `);
      await this.databaseService.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_batches_status_created
        ON payment_batches (status, created_at DESC)
      `);
      await this.databaseService.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_batches_payroll_batch
        ON payment_batches (payroll_batch_id)
      `);
      await this.databaseService.query(`
        CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_status
        ON payment_reconciliations (status)
      `);
      await this.databaseService.query(`
        CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_statement_matched
        ON bank_statement_lines (bank_statement_id, matched, credit)
      `);
    } catch (error: any) {
      this.logger.warn(`ensurePerformanceIndexes failed: ${error?.message}`);
    }
  }

  // ==================== BANK ACCOUNTS ====================

  async createBankAccount(dto: CreateBankAccountDto, userId: string) {
    // Map DTO fields handling both camelCase and snake_case inputs
    const accountNumber = dto.accountNumber || dto.account_number;
    const bankName = dto.bankName || dto.bank_name;
    const accountName = dto.accountName || dto.account_name;
    const bankCode = dto.bankCode || dto.bank_code;
    const accountType = dto.accountType || dto.account_type;
    const isActive = dto.isActive !== undefined ? dto.isActive : (dto.is_active !== undefined ? dto.is_active : true);

    const existing = await this.databaseService.queryOne(
      'SELECT id FROM bank_accounts WHERE account_number = $1 AND bank_name = $2',
      [accountNumber, bankName],
    );

    if (existing) {
      throw new BadRequestException('Bank account already exists');
    }

    const account = await this.databaseService.queryOne(
      `INSERT INTO bank_accounts (
        account_number, account_name, bank_name, bank_code, 
        branch_name, account_type, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        accountNumber,
        accountName,
        bankName,
        bankCode || null,
        dto.branchName || null,
        accountType || 'salary_disbursement',
        isActive,
        userId,
      ],
    );

    this.logger.log(`Bank account ${accountNumber} created`);
    return account;
  }

  async findAllBankAccounts(isActive?: boolean) {
    let query = 'SELECT * FROM bank_accounts';
    const params = [];

    if (isActive !== undefined) {
      query += ' WHERE is_active = $1';
      params.push(isActive);
    }

    query += ' ORDER BY created_at DESC';

    return this.databaseService.query(query, params);
  }

  async findOneBankAccount(id: string) {
    const account = await this.databaseService.queryOne(
      'SELECT * FROM bank_accounts WHERE id = $1',
      [id],
    );

    if (!account) {
      throw new NotFoundException('Bank account not found');
    }

    return account;
  }

  async updateBankAccount(id: string, dto: UpdateBankAccountDto, userId: string) {
    await this.findOneBankAccount(id);

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (dto.accountName) {
      updates.push(`account_name = $${paramIndex++}`);
      values.push(dto.accountName);
    }
    if (dto.branchName !== undefined) {
      updates.push(`branch_name = $${paramIndex++}`);
      values.push(dto.branchName);
    }
    if (dto.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(dto.isActive);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE bank_accounts 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    return this.databaseService.queryOne(query, values);
  }

  async deleteBankAccount(id: string, userId: string) {
    await this.findOneBankAccount(id);

    const linkedBatchCount = await this.databaseService.queryOne(
      'SELECT COUNT(*)::int AS count FROM payment_batches WHERE bank_account_id = $1',
      [id],
    );
    const linkedStatementCount = await this.databaseService.queryOne(
      'SELECT COUNT(*)::int AS count FROM bank_statements WHERE bank_account_id = $1',
      [id],
    );
    const hasLinks = (linkedBatchCount?.count || 0) > 0 || (linkedStatementCount?.count || 0) > 0;

    if (hasLinks) {
      await this.databaseService.query(
        `UPDATE bank_accounts SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
        [id],
      );
      this.logger.log(`Bank account ${id} deactivated due to linked records`);
      return { message: 'Bank account has linked records and was deactivated instead' };
    }

    await this.databaseService.query('DELETE FROM bank_accounts WHERE id = $1', [id]);
    this.logger.log(`Bank account ${id} deleted`);
    return { message: 'Bank account deleted successfully' };
  }

  // ==================== PAYMENT BATCHES ====================

  async createPaymentBatch(dto: CreatePaymentBatchDto, userId: string) {
    const payrollBatch = await this.databaseService.queryOne(
      'SELECT * FROM payroll_batches WHERE id = $1',
      [dto.payrollBatchId],
    );

    if (!payrollBatch) {
      throw new NotFoundException('Payroll batch not found');
    }

    if (payrollBatch.status !== 'approved' && payrollBatch.status !== 'ready_for_payment') {
      throw new BadRequestException('Payroll batch must be approved or ready for payment');
    }

    const existingBatch = await this.databaseService.queryOne(
      `SELECT status FROM payment_batches WHERE payroll_batch_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [dto.payrollBatchId],
    );
    if (existingBatch && ['pending', 'pending_approval', 'approved', 'processing', 'completed', 'confirmed', 'partially_completed'].includes(existingBatch.status)) {
      throw new BadRequestException('A payment batch already exists for this payroll batch');
    }

    const lines = await this.databaseService.query(
      'SELECT * FROM payroll_lines WHERE payroll_batch_id = $1',
      [dto.payrollBatchId],
    );

    if (lines.length === 0) {
      throw new BadRequestException('No payroll lines found');
    }

    // Generate batch number
    const year = new Date().getFullYear();
    const count = await this.databaseService.queryOne(
      `SELECT COUNT(*) as count FROM payment_batches 
       WHERE batch_number LIKE $1`,
      [`PAY/${year}/%`],
    );
    const batchNumber = `PAY/${year}/${String(parseInt(count.count) + 1).padStart(4, '0')}`;

    // Calculate totals
    const totalAmount = lines.reduce((sum, line) => {
      const amt = typeof line.net_pay === 'number' ? line.net_pay : parseFloat(line.net_pay || '0');
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);
    const totalTransactions = lines.length;

    // Get bank name if provided
    let bankName = 'Multiple Banks';
    if (dto.bankAccountId) {
      const bankAccount = await this.findOneBankAccount(dto.bankAccountId);
      bankName = bankAccount.bank_name;
    }

    const paymentBatch = await this.databaseService.queryOne(
      `INSERT INTO payment_batches (
        batch_number, payroll_batch_id, bank_account_id, payment_method,
        file_format, total_amount, total_transactions, bank_name,
        created_by, created_by_name, status, approved_by, approved_by_name, approved_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'approved', $9, $10, NOW())
      RETURNING *`,
      [
        batchNumber,
        dto.payrollBatchId,
        dto.bankAccountId || null,
        dto.paymentMethod,
        dto.fileFormat,
        totalAmount,
        totalTransactions,
        bankName,
        userId,
        dto.userName,
      ],
    );

    await this.databaseService.query(
      `INSERT INTO payment_transactions (
        payment_batch_id, staff_id, staff_number, staff_name,
        bank_name, account_number, amount, status, bank_response_message
      )
      SELECT
        $1,
        pl.staff_id,
        s.staff_number,
        COALESCE(NULLIF(TRIM(s.account_name), ''), TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, '')))),
        COALESCE(NULLIF(TRIM(s.bank_name), ''), 'N/A'),
        COALESCE(NULLIF(TRIM(s.account_number), ''), 'N/A'),
        COALESCE(pl.net_pay::numeric, 0),
        CASE
          WHEN s.bank_name IS NOT NULL
           AND TRIM(s.bank_name) <> ''
           AND s.account_number IS NOT NULL
           AND TRIM(s.account_number) <> ''
           AND s.account_number <> 'N/A'
          THEN 'pending'
          ELSE 'failed'
        END,
        CASE
          WHEN s.bank_name IS NOT NULL
           AND TRIM(s.bank_name) <> ''
           AND s.account_number IS NOT NULL
           AND TRIM(s.account_number) <> ''
           AND s.account_number <> 'N/A'
          THEN NULL
          ELSE 'Missing bank details'
        END
      FROM payroll_lines pl
      INNER JOIN staff s ON s.id = pl.staff_id
      WHERE pl.payroll_batch_id = $2`,
      [paymentBatch.id, dto.payrollBatchId],
    );

    await this.databaseService.query(
      `UPDATE payroll_batches 
       SET payment_status = 'pending', updated_at = NOW()
       WHERE id = $1`,
      [dto.payrollBatchId],
    );

    this.logger.log(`Payment batch ${batchNumber} created`);
    return paymentBatch;
  }

  async findAllPaymentBatches() {
    const query = `
      SELECT pb.*, pl.payroll_month AS payroll_month
      FROM payment_batches pb
      LEFT JOIN payroll_batches pl ON pb.payroll_batch_id = pl.id
      ORDER BY pb.created_at DESC
    `;
    return this.databaseService.query(query);
  }

  async findOnePaymentBatch(id: string) {
    const batch = await this.databaseService.queryOne(
      `SELECT pb.*, pl.payroll_month AS payroll_month, pl.period_start AS period_start, pl.period_end AS period_end
       FROM payment_batches pb
       LEFT JOIN payroll_batches pl ON pb.payroll_batch_id = pl.id
       WHERE pb.id = $1`,
      [id],
    );

    if (!batch) {
      throw new NotFoundException('Payment batch not found');
    }

    return batch;
  }

  async getPaymentBatchTransactions(id: string) {
    await this.findOnePaymentBatch(id);

    return this.databaseService.query(
      'SELECT * FROM payment_transactions WHERE payment_batch_id = $1 ORDER BY staff_number',
      [id],
    );
  }

  async updatePaymentBatchStatus(id: string, dto: UpdatePaymentBatchDto, userId: string) {
    await this.findOnePaymentBatch(id);
    const guardedStatuses = new Set(['approved', 'processing', 'completed', 'confirmed']);
    if (guardedStatuses.has(dto.status)) {
      throw new BadRequestException('Use the approval and payment flow endpoints for this status');
    }

    const updated = await this.databaseService.queryOne(
      `UPDATE payment_batches 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [dto.status, id],
    );

    this.logger.log(`Payment batch ${id} status updated to ${dto.status}`);
    return updated;
  }

  async getSupportedBanks() {
    return Object.entries(this.BANK_SORT_CODES).map(([name, code]) => ({
      name: name.replace(/\b\w/g, l => l.toUpperCase()), // Title Case
      code
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  async generatePaymentFile(id: string, userId: string) {
    const batch = await this.findOnePaymentBatch(id);
    const transactions = await this.databaseService.query(
      "SELECT * FROM payment_transactions WHERE payment_batch_id = $1 AND status != 'failed' ORDER BY staff_number",
      [id],
    );

    let content = '';
    let filename = '';

    let paymentDate = '';
    if (batch.period_end) {
      paymentDate = new Date(batch.period_end).toISOString().slice(0, 10);
    } else if (batch.payroll_month) {
      const [year, month] = String(batch.payroll_month).split('-').map(Number);
      if (!Number.isNaN(year) && !Number.isNaN(month)) {
        paymentDate = new Date(year, month, 0).toISOString().slice(0, 10);
      }
    }
    if (!paymentDate) {
      paymentDate = new Date().toISOString().slice(0, 10);
    }

    let debitAccountNumber = '';
    if (batch.bank_account_id) {
      const bankAccount = await this.databaseService.queryOne(
        'SELECT account_number FROM bank_accounts WHERE id = $1',
        [batch.bank_account_id],
      );
      debitAccountNumber = bankAccount?.account_number || '';
    }

    if (batch.file_format === 'nibss') {
      // NIBSS Format: SerialNumber,AccountNumber,BankCode,Amount,BeneficiaryName,Narration
      content = 'SerialNumber,AccountNumber,BankCode,Amount,BeneficiaryName,Narration\n';
      let serial = 1;
      for (const txn of transactions) {
        const bankCode = this.BANK_SORT_CODES[txn.bank_name?.toLowerCase()] || '';
        content += `${serial++},${txn.account_number},${bankCode},${txn.amount},"${txn.staff_name}","Salary Payment ${batch.batch_number}"\n`;
      }
      filename = `NIBSS_${batch.batch_number.replace(/\//g, '-')}.csv`;
    } else if (batch.file_format === 'remita') {
      // Remita Format: BeneficiaryName,BeneficiaryAccount,BankCode,BeneficiaryAmount,Narration
      content = 'BeneficiaryName,BeneficiaryAccount,BankCode,BeneficiaryAmount,Narration\n';
      for (const txn of transactions) {
        const bankCode = this.BANK_SORT_CODES[txn.bank_name?.toLowerCase()] || '';
        content += `"${txn.staff_name}",${txn.account_number},${bankCode},${txn.amount},"Salary Payment ${batch.batch_number}"\n`;
      }
      filename = `REMITA_${batch.batch_number.replace(/\//g, '-')}.csv`;
    } else if (batch.file_format === 'custom_csv') {
      content = 'Transaction Reference Number,Beneficiary Name,Payment Amount,Payment Date,Beneficiary Code,Beneficiary Account Number,Bank Sort Code,Account Number to Debit\n';
      for (const txn of transactions) {
        const bankName = String(txn.bank_name || '').toLowerCase();
        const bankCode = bankName.includes('zenith') ? '' : (this.BANK_SORT_CODES[bankName] || '');
        content += `"${batch.batch_number}","${txn.staff_name}",${txn.amount},${paymentDate},${txn.staff_number || ''},${txn.account_number || ''},${bankCode},${debitAccountNumber}\n`;
      }
      filename = `CUSTOM_${batch.batch_number.replace(/\//g, '-')}.csv`;
    } else if (batch.file_format === 'csv') {
      content = 'Account Number,Account Name,Bank Name,Amount,Narration\n';
      for (const txn of transactions) {
        content += `${txn.account_number},"${txn.staff_name}","${txn.bank_name}",${txn.amount},"Salary Payment ${batch.batch_number}"\n`;
      }
      filename = `${batch.batch_number.replace(/\//g, '-')}.csv`;
    } else if (batch.file_format === 'excel') {
      content = 'Excel format not yet implemented';
      filename = `${batch.batch_number.replace(/\//g, '-')}.xlsx`;
    }

    // Update batch status
    await this.databaseService.query(
      `UPDATE payment_batches 
       SET file_generated = true, file_path = $1, updated_at = NOW()
       WHERE id = $2`,
      [filename, id],
    );

    return { content, filename };
  }

  async processPayment(id: string, dto: ProcessPaymentDto, userId: string) {
    const batch = await this.findOnePaymentBatch(id);

    if (batch.status !== 'approved') {
      throw new BadRequestException('Batch must be approved before processing');
    }
    if (!batch.approved_by || !batch.approved_at) {
      throw new BadRequestException('Approval details are required before processing');
    }

    await this.databaseService.query(
      `UPDATE payment_batches 
       SET status = 'processing', processed_at = NOW(), processed_by = $1, updated_at = NOW()
       WHERE id = $2`,
      [userId, id],
    );

    this.logger.log(`Payment batch ${batch.batch_number} processing started`);
    return { message: 'Payment processing initiated' };
  }

  async approvePaymentBatch(id: string, dto: ApprovePaymentDto, userId: string) {
    const batch = await this.findOnePaymentBatch(id);

    const updated = await this.databaseService.queryOne(
      `UPDATE payment_batches 
       SET status = 'approved', approved_by = $1, approved_by_name = $2, 
           approved_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [dto.approverId, dto.approverName, id],
    );

    this.logger.log(`Payment batch ${batch.batch_number} approved`);
    return updated;
  }

  async executePaymentBatch(id: string, reference: string, userId: string) {
    const batch = await this.findOnePaymentBatch(id);
    if (!['approved', 'processing'].includes(batch.status)) {
      throw new BadRequestException('Batch must be approved or processing before execution');
    }
    await this.databaseService.transaction(async (client) => {
      if (batch.status === 'approved' && (!batch.approved_by || !batch.approved_at)) {
        await client.query(
          `UPDATE payment_batches 
           SET approved_by = $1, approved_by_name = 'System Auto-Approve', approved_at = NOW()
           WHERE id = $2`,
          [userId, id],
        );
      }

      await client.query(
        `UPDATE payment_transactions 
         SET status = 'completed', payment_date = NOW(), updated_at = NOW()
         WHERE payment_batch_id = $1
           AND status IN ('pending', 'processing')`,
        [id],
      );

      await client.query(
        `UPDATE payment_batches 
         SET status = 'completed', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [id],
      );

      if (batch.payroll_batch_id) {
        await client.query(
          `UPDATE payroll_batches 
           SET status = 'paid',
               payment_status = 'completed',
               payment_reference = $1,
               payment_executed_by = $2,
               payment_executed_at = NOW(),
               updated_at = NOW()
           WHERE id = $3`,
          [reference, userId, batch.payroll_batch_id],
        );
      }
    });

    this.logger.log(`Payment batch ${batch.batch_number} executed`);
    return { message: 'Payment batch executed successfully' };
  }

  async confirmPaymentBatch(id: string, userId: string) {
    const batch = await this.findOnePaymentBatch(id);

    await this.databaseService.query(
      `UPDATE payment_batches 
       SET status = 'confirmed', updated_at = NOW()
       WHERE id = $1`,
      [id],
    );

    this.logger.log(`Payment batch ${batch.batch_number} confirmed`);
    return { message: 'Payment batch confirmed' };
  }

  async retryFailedTransaction(id: string, userId: string) {
    const transaction = await this.databaseService.queryOne(
      'SELECT * FROM payment_transactions WHERE id = $1',
      [id],
    );

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.status !== 'failed') {
      throw new BadRequestException('Can only retry failed transactions');
    }

    await this.databaseService.query(
      `UPDATE payment_transactions 
       SET status = 'pending', retry_count = retry_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [id],
    );

    this.logger.log(`Transaction ${id} retry initiated`);
    return { message: 'Transaction retry initiated' };
  }

  // ==================== BANK STATEMENTS ====================

  async uploadBankStatement(dto: CreateBankStatementDto, userId: string) {
    await this.findOneBankAccount(dto.bankAccountId);

    // Generate statement number
    const year = new Date().getFullYear();
    const count = await this.databaseService.queryOne(
      `SELECT COUNT(*) as count FROM bank_statements 
       WHERE statement_number LIKE $1`,
      [`STMT/${year}/%`],
    );
    const stmtNumber = `STMT/${year}/${String(parseInt(count.count) + 1).padStart(4, '0')}`;

    const statement = await this.databaseService.queryOne(
      `INSERT INTO bank_statements (
        statement_number, bank_account_id, file_name, statement_date,
        opening_balance, closing_balance, uploaded_by, uploaded_by_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        stmtNumber,
        dto.bankAccountId,
        dto.fileName,
        dto.statementDate,
        dto.openingBalance,
        dto.closingBalance,
        userId,
        dto.userName,
      ],
    );

    this.logger.log(`Bank statement ${stmtNumber} uploaded`);
    return statement;
  }

  async findAllBankStatements() {
    return this.databaseService.query(
      'SELECT * FROM bank_statements ORDER BY statement_date DESC',
    );
  }

  async findOneBankStatement(id: string) {
    const statement = await this.databaseService.queryOne(
      'SELECT * FROM bank_statements WHERE id = $1',
      [id],
    );

    if (!statement) {
      throw new NotFoundException('Bank statement not found');
    }

    return statement;
  }

  async getStatementLines(id: string) {
    await this.findOneBankStatement(id);

    return this.databaseService.query(
      'SELECT * FROM bank_statement_lines WHERE bank_statement_id = $1 ORDER BY transaction_date',
      [id],
    );
  }

  async parseStatement(id: string, dto: ParseStatementDto, userId: string) {
    const statement = await this.findOneBankStatement(id);

    if (statement.parsed) {
      throw new BadRequestException('Statement already parsed');
    }

    const lines = dto.csvContent.split('\n').filter(line => line.trim());
    let totalDebits = 0;
    let totalCredits = 0;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < 5) continue;

      const [date, description, reference, debit, credit] = parts;
      const debitAmount = parseFloat(debit) || 0;
      const creditAmount = parseFloat(credit) || 0;

      totalDebits += debitAmount;
      totalCredits += creditAmount;

      await this.databaseService.query(
        `INSERT INTO bank_statement_lines (
          bank_statement_id, transaction_date, description, reference,
          debit, credit
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, date, description, reference, debitAmount, creditAmount],
      );
    }

    await this.databaseService.query(
      `UPDATE bank_statements 
       SET parsed = true, total_debits = $1, total_credits = $2, 
           total_transactions = $3, updated_at = NOW()
       WHERE id = $4`,
      [totalDebits, totalCredits, lines.length - 1, id],
    );

    this.logger.log(`Bank statement ${statement.statement_number} parsed`);
    return { message: 'Statement parsed successfully' };
  }

  // ==================== RECONCILIATION ====================

  async createReconciliation(dto: CreateReconciliationDto, userId: string) {
    await this.findOnePaymentBatch(dto.paymentBatchId);
    await this.findOneBankStatement(dto.statementId);

    // Generate reconciliation number
    const year = new Date().getFullYear();
    const count = await this.databaseService.queryOne(
      `SELECT COUNT(*) as count FROM payment_reconciliations 
       WHERE reconciliation_number LIKE $1`,
      [`REC/${year}/%`],
    );
    const recNumber = `REC/${year}/${String(parseInt(count.count) + 1).padStart(4, '0')}`;

    const reconciliation = await this.databaseService.queryOne(
      `INSERT INTO payment_reconciliations (
        reconciliation_number, payment_batch_id, bank_statement_id,
        performed_by, status
      ) VALUES ($1, $2, $3, $4, 'in_progress')
      RETURNING *`,
      [recNumber, dto.paymentBatchId, dto.statementId, userId],
    );

    this.logger.log(`Reconciliation ${recNumber} created`);
    return reconciliation;
  }

  async findAllReconciliations() {
    return this.databaseService.query(
      'SELECT * FROM payment_reconciliations ORDER BY created_at DESC',
    );
  }

  async findOneReconciliation(id: string) {
    const reconciliation = await this.databaseService.queryOne(
      'SELECT * FROM payment_reconciliations WHERE id = $1',
      [id],
    );

    if (!reconciliation) {
      throw new NotFoundException('Reconciliation not found');
    }

    return reconciliation;
  }

  async autoMatchTransactions(id: string, userId: string) {
    const reconciliation = await this.findOneReconciliation(id);
    const result = await this.databaseService.queryOne<{ match_count: string }>(
      `WITH eligible_transactions AS (
         SELECT 
           pt.id,
           ROUND(pt.amount::numeric, 2) AS rounded_amount,
           ROW_NUMBER() OVER (
             PARTITION BY ROUND(pt.amount::numeric, 2) 
             ORDER BY pt.created_at, pt.id
           ) AS rn
         FROM payment_transactions pt
         WHERE pt.payment_batch_id = $1
           AND COALESCE(pt.reconciled, false) = false
       ),
       eligible_lines AS (
         SELECT 
           bsl.id,
           ROUND(bsl.credit::numeric, 2) AS rounded_amount,
           ROW_NUMBER() OVER (
             PARTITION BY ROUND(bsl.credit::numeric, 2) 
             ORDER BY bsl.transaction_date, bsl.id
           ) AS rn
         FROM bank_statement_lines bsl
         WHERE bsl.bank_statement_id = $2
           AND COALESCE(bsl.matched, false) = false
           AND COALESCE(bsl.credit, 0) > 0
       ),
       matches AS (
         SELECT 
           et.id AS transaction_id,
           el.id AS statement_line_id
         FROM eligible_transactions et
         INNER JOIN eligible_lines el
           ON et.rounded_amount = el.rounded_amount
          AND et.rn = el.rn
       ),
       updated_lines AS (
         UPDATE bank_statement_lines bsl
         SET 
           matched = true,
           matched_transaction_id = m.transaction_id,
           match_type = 'automatic',
           matched_at = NOW()
         FROM matches m
         WHERE bsl.id = m.statement_line_id
         RETURNING bsl.id
       ),
       updated_transactions AS (
         UPDATE payment_transactions pt
         SET 
           reconciled = true,
           reconciliation_date = NOW()
         FROM matches m
         WHERE pt.id = m.transaction_id
         RETURNING pt.id
       )
       SELECT COUNT(*)::text AS match_count FROM matches`,
      [reconciliation.payment_batch_id, reconciliation.bank_statement_id],
    );

    const matchCount = parseInt(result?.match_count || '0', 10);

    await this.databaseService.query(
      `UPDATE payment_reconciliations 
       SET matched_count = $1, updated_at = NOW()
       WHERE id = $2`,
      [matchCount, id],
    );

    this.logger.log(`Auto-match completed: ${matchCount} matches`);
    return { matchCount };
  }

  async manualMatchTransaction(dto: ManualMatchDto, userId: string) {
    const transaction = await this.databaseService.queryOne(
      'SELECT * FROM payment_transactions WHERE id = $1',
      [dto.transactionId],
    );

    const line = await this.databaseService.queryOne(
      'SELECT * FROM bank_statement_lines WHERE id = $1',
      [dto.statementLineId],
    );

    if (!transaction || !line) {
      throw new NotFoundException('Transaction or statement line not found');
    }

    await this.databaseService.query(
      `UPDATE bank_statement_lines 
       SET matched = true, matched_transaction_id = $1, 
           match_type = 'manual', matched_by = $2, matched_at = NOW()
       WHERE id = $3`,
      [dto.transactionId, userId, dto.statementLineId],
    );

    await this.databaseService.query(
      `UPDATE payment_transactions 
       SET reconciled = true, reconciliation_date = NOW()
       WHERE id = $1`,
      [dto.transactionId],
    );

    this.logger.log(`Manual match completed`);
    return { message: 'Transaction matched successfully' };
  }

  // ==================== EXCEPTIONS ====================

  async createException(dto: CreateExceptionDto, userId: string) {
    // Generate exception number
    const year = new Date().getFullYear();
    const count = await this.databaseService.queryOne(
      `SELECT COUNT(*) as count FROM payment_exceptions 
       WHERE exception_number LIKE $1`,
      [`EXC/${year}/%`],
    );
    const excNumber = `EXC/${year}/${String(parseInt(count.count) + 1).padStart(4, '0')}`;

    const exception = await this.databaseService.queryOne(
      `INSERT INTO payment_exceptions (
        exception_number, related_entity_type, related_entity_id,
        exception_type, severity, description, raised_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
      RETURNING *`,
      [
        excNumber,
        dto.relatedEntityType,
        dto.relatedEntityId,
        dto.exceptionType,
        dto.severity,
        dto.description,
        dto.raisedBy,
      ],
    );

    this.logger.log(`Exception ${excNumber} created`);
    return exception;
  }

  async findAllExceptions() {
    return this.databaseService.query(
      'SELECT * FROM payment_exceptions ORDER BY created_at DESC',
    );
  }

  async findOneException(id: string) {
    const exception = await this.databaseService.queryOne(
      'SELECT * FROM payment_exceptions WHERE id = $1',
      [id],
    );

    if (!exception) {
      throw new NotFoundException('Exception not found');
    }

    return exception;
  }

  async resolveException(id: string, dto: ResolveExceptionDto, userId: string) {
    await this.findOneException(id);

    const updated = await this.databaseService.queryOne(
      `UPDATE payment_exceptions 
       SET status = 'resolved', resolution_notes = $1, 
           resolved_by = $2, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [dto.resolutionNotes, dto.resolvedBy, id],
    );

    this.logger.log(`Exception ${id} resolved`);
    return updated;
  }

  async escalateException(id: string, dto: EscalateExceptionDto, userId: string) {
    await this.findOneException(id);

    const updated = await this.databaseService.queryOne(
      `UPDATE payment_exceptions 
       SET status = 'escalated', escalation_notes = $1, 
           escalated_by = $2, escalated_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [dto.escalationNotes, dto.escalatedBy, id],
    );

    this.logger.log(`Exception ${id} escalated`);
    return updated;
  }

  // ==================== STATISTICS ====================

  async getDashboardStats() {
    // 1. Payment Batch Stats
    const batchStats = await this.databaseService.queryOne(`
      SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_batches,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_batches,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_batches,
        COALESCE(SUM(CASE WHEN status IN ('completed', 'processing') THEN total_amount ELSE 0 END), 0) as total_amount_processed,
        COUNT(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE) 
                     AND created_at < (date_trunc('month', CURRENT_DATE) + interval '1 month') THEN 1 END) as this_month_batches,
        COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', CURRENT_DATE) 
                           AND created_at < (date_trunc('month', CURRENT_DATE) + interval '1 month') THEN total_amount ELSE 0 END), 0) as this_month_amount
      FROM payment_batches
    `);

    // 2. Transaction Stats
    const transactionStats = await this.databaseService.queryOne(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_transactions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions
      FROM payment_transactions
    `);

    // 3. Exception Stats
    const exceptionStats = await this.databaseService.queryOne(`
      SELECT 
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_exceptions,
        COUNT(CASE WHEN status = 'open' AND severity = 'critical' THEN 1 END) as critical_exceptions
      FROM payment_exceptions
    `);

    // 4. Reconciliation Stats
    const reconciliationStats = await this.databaseService.queryOne(`
      SELECT COUNT(*) as reconciliation_pending
      FROM payment_reconciliations
      WHERE status != 'completed'
    `);

    // Combine all stats
    return {
      pending_batches: parseInt(batchStats.pending_batches || '0'),
      processing_batches: parseInt(batchStats.processing_batches || '0'),
      completed_batches: parseInt(batchStats.completed_batches || '0'),
      total_amount_processed: parseFloat(batchStats.total_amount_processed || '0'),
      this_month_batches: parseInt(batchStats.this_month_batches || '0'),
      this_month_amount: parseFloat(batchStats.this_month_amount || '0'),
      
      total_transactions: parseInt(transactionStats.total_transactions || '0'),
      successful_transactions: parseInt(transactionStats.successful_transactions || '0'),
      failed_transactions: parseInt(transactionStats.failed_transactions || '0'),
      
      open_exceptions: parseInt(exceptionStats.open_exceptions || '0'),
      critical_exceptions: parseInt(exceptionStats.critical_exceptions || '0'),
      
      reconciliation_pending: parseInt(reconciliationStats.reconciliation_pending || '0'),
    };
  }
}
