import { Client } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

async function seedDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // ==================== 1. SEED USERS ====================
    console.log('\n📝 Seeding users...');
    
    const adminPassword = await bcrypt.hash('admin123', 10);
    const hrPassword = await bcrypt.hash('hr123', 10);
    const accountantPassword = await bcrypt.hash('acc123', 10);
    const loaderPassword = await bcrypt.hash('loader123', 10);
    const approverPassword = await bcrypt.hash('approver123', 10);

    const users = [
      { email: 'admin@jsc.gov.ng', password: adminPassword, full_name: 'System Administrator', role: 'admin' },
      { email: 'hr@jsc.gov.ng', password: hrPassword, full_name: 'HR Manager', role: 'hr_manager' },
      { email: 'accounts@jsc.gov.ng', password: accountantPassword, full_name: 'Chief Accountant', role: 'cashier' },
      { email: 'loader@jsc.gov.ng', password: loaderPassword, full_name: 'Payroll Loader', role: 'payroll_loader' },
      { email: 'approver@jsc.gov.ng', password: approverPassword, full_name: 'Payroll Approver', role: 'approver' },
    ];

    for (const user of users) {
      await client.query(
        `INSERT INTO users (email, password_hash, full_name, role, status) 
         VALUES ($1, $2, $3, $4, 'active') 
         ON CONFLICT (email) DO NOTHING`,
        [user.email, user.password, user.full_name, user.role]
      );
    }
    console.log('✅ Seeded 3 users');

    // ==================== 2. SEED DEPARTMENTS ====================
    console.log('\n📝 Seeding departments...');
    
    const departments = [
      { code: 'HR', name: 'Human Resources', description: 'Human Resources Department' },
      { code: 'FIN', name: 'Finance', description: 'Finance & Accounts Department' },
      { code: 'ADMIN', name: 'Administration', description: 'Administration Department' },
      { code: 'LEGAL', name: 'Legal Services', description: 'Legal Services Department' },
      { code: 'IT', name: 'Information Technology', description: 'IT Department' },
      { code: 'AUDIT', name: 'Internal Audit', description: 'Internal Audit Department' },
    ];

    for (const dept of departments) {
      await client.query(
        `INSERT INTO departments (code, name, description, status) 
         VALUES ($1, $2, $3, 'active') 
         ON CONFLICT (code) DO NOTHING`,
        [dept.code, dept.name, dept.description]
      );
    }
    console.log('✅ Seeded 6 departments');

    // ==================== 3. SEED GLOBAL ALLOWANCES ====================
    console.log('\n📝 Seeding global allowances...');
    
    const adminUserId = (await client.query(`SELECT id FROM users WHERE email = 'admin@jsc.gov.ng' LIMIT 1`)).rows[0]?.id;

    const allowances = [
      { code: 'HOUSING', name: 'Housing Allowance', type: 'percentage', percentage: 40, is_taxable: true, applies_to_all: true },
      { code: 'TRANSPORT', name: 'Transport Allowance', type: 'percentage', percentage: 20, is_taxable: true, applies_to_all: true },
      { code: 'UTILITY', name: 'Utility Allowance', type: 'percentage', percentage: 15, is_taxable: true, applies_to_all: true },
      { code: 'MEAL', name: 'Meal Allowance', type: 'percentage', percentage: 10, is_taxable: false, applies_to_all: true },
      { code: 'MEDICAL', name: 'Medical Allowance', type: 'percentage', percentage: 5, is_taxable: false, applies_to_all: true },
    ];

    for (const allowance of allowances) {
      await client.query(
        `INSERT INTO allowances (code, name, type, amount, percentage, is_taxable, applies_to_all, status, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8) 
         ON CONFLICT (code) DO NOTHING`,
        [
          allowance.code, 
          allowance.name, 
          allowance.type, 
          null, 
          allowance.percentage, 
          allowance.is_taxable, 
          allowance.applies_to_all, 
          adminUserId
        ]
      );
    }
    console.log('✅ Seeded 5 global allowances');

    // ==================== 4. SEED GLOBAL DEDUCTIONS ====================
    console.log('\n📝 Seeding global deductions...');
    
    const deductions = [
      { code: 'PENSION', name: 'Pension Contribution', type: 'percentage', percentage: 10, is_statutory: true },
      { code: 'NHF', name: 'National Housing Fund', type: 'percentage', percentage: 2.5, is_statutory: true },
      { code: 'UNION', name: 'Union Dues', type: 'fixed', amount: 5000, is_statutory: false },
    ];

    for (const deduction of deductions) {
      await client.query(
        `INSERT INTO deductions (code, name, type, amount, percentage, is_statutory, status, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6, 'active', $7) 
         ON CONFLICT (code) DO NOTHING`,
        [
          deduction.code,
          deduction.name,
          deduction.type,
          deduction.amount || null,
          deduction.percentage || null,
          deduction.is_statutory,
          adminUserId
        ]
      );
    }
    console.log('✅ Seeded 3 global deductions');

    // ==================== 5. SEED SAMPLE STAFF ====================
    console.log('\n📝 Seeding sample staff...');
    
    const hrDeptId = (await client.query(`SELECT id FROM departments WHERE code = 'HR' LIMIT 1`)).rows[0]?.id;
    const finDeptId = (await client.query(`SELECT id FROM departments WHERE code = 'FIN' LIMIT 1`)).rows[0]?.id;

    const staff = [
      {
        staff_number: 'JSC/2024/001',
        first_name: 'Adebayo',
        last_name: 'Ogunleye',
        email: 'adebayo.ogunleye@jsc.gov.ng',
        department_id: hrDeptId,
        designation: 'Senior HR Officer',
        employment_type: 'permanent',
        employment_date: '2020-01-15',
        current_basic_salary: 350000,
        state_of_origin: 'Lagos',
        status: 'active',
      },
      {
        staff_number: 'JSC/2024/002',
        first_name: 'Fatima',
        last_name: 'Abdullahi',
        email: 'fatima.abdullahi@jsc.gov.ng',
        department_id: finDeptId,
        designation: 'Accountant II',
        employment_type: 'permanent',
        employment_date: '2019-03-20',
        current_basic_salary: 400000,
        state_of_origin: 'Kano',
        status: 'active',
      },
      {
        staff_number: 'JSC/2024/003',
        first_name: 'Chinedu',
        last_name: 'Okafor',
        email: 'chinedu.okafor@jsc.gov.ng',
        department_id: hrDeptId,
        designation: 'HR Assistant',
        employment_type: 'contract',
        employment_date: '2023-06-01',
        current_basic_salary: 250000,
        state_of_origin: 'Anambra',
        status: 'active',
      },
    ];

    for (const s of staff) {
      await client.query(
        `INSERT INTO staff (
          staff_number, first_name, last_name, email, department_id, designation,
          employment_type, employment_date, current_basic_salary, state_of_origin,
          status, created_by, nationality
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Nigerian')
        ON CONFLICT (staff_number) DO NOTHING`,
        [
          s.staff_number, s.first_name, s.last_name, s.email, s.department_id,
          s.designation, s.employment_type, s.employment_date, s.current_basic_salary,
          s.state_of_origin, s.status, adminUserId
        ]
      );
    }
    console.log('✅ Seeded 3 sample staff members');

    // ==================== 6. SEED LEAVE TYPES ====================
    console.log('\n📝 Seeding leave types...');
    
    const leaveTypes = [
      { name: 'Annual Leave', annual_days: 30, is_paid: true, carries_forward: true },
      { name: 'Sick Leave', annual_days: 10, is_paid: true, carries_forward: false },
      { name: 'Maternity Leave', annual_days: 112, is_paid: true, carries_forward: false },
      { name: 'Paternity Leave', annual_days: 14, is_paid: true, carries_forward: false },
      { name: 'Study Leave', annual_days: 30, is_paid: true, carries_forward: false },
      { name: 'Compassionate Leave', annual_days: 3, is_paid: true, carries_forward: false },
    ];

    for (const lt of leaveTypes) {
      await client.query(
        `INSERT INTO leave_types (name, annual_days, is_paid, carries_forward, status, created_by)
         VALUES ($1, $2, $3, $4, 'active', $5)
         ON CONFLICT (name) DO NOTHING`,
        [lt.name, lt.annual_days, lt.is_paid, lt.carries_forward, adminUserId]
      );
    }
    console.log('✅ Seeded 6 leave types');

    // ==================== 7. SEED COOPERATIVES ====================
    console.log('\n📝 Seeding cooperatives...');
    
    const cooperatives = [
      { code: 'JSC-COOP', name: 'JSC Staff Cooperative Society', type: 'multi_purpose', registration_fee: 10000, monthly_contribution: 5000, interest_rate: 5 },
      { code: 'JSC-THRIFT', name: 'JSC Thrift & Credit Society', type: 'thrift', registration_fee: 5000, monthly_contribution: 10000, interest_rate: 3 },
    ];

    for (const coop of cooperatives) {
      await client.query(
        `INSERT INTO cooperatives (code, name, type, registration_fee, monthly_contribution, interest_rate, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
         ON CONFLICT (code) DO NOTHING`,
        [coop.code, coop.name, coop.type, coop.registration_fee, coop.monthly_contribution, coop.interest_rate, adminUserId]
      );
    }
    console.log('✅ Seeded 2 cooperatives');

    // ==================== 8. SEED LOAN TYPES ====================
    console.log('\n📝 Seeding loan types...');
    
    const loanTypes = [
      { code: 'PERSONAL', name: 'Personal Loan', max_amount: 500000, interest_rate: 5, max_tenure_months: 12, required_guarantors: 2 },
      { code: 'SALARY_ADVANCE', name: 'Salary Advance', max_amount: 200000, interest_rate: 0, max_tenure_months: 6, required_guarantors: 1 },
      { code: 'EMERGENCY', name: 'Emergency Loan', max_amount: 300000, interest_rate: 3, max_tenure_months: 9, required_guarantors: 1 },
    ];

    for (const lt of loanTypes) {
      await client.query(
        `INSERT INTO loan_types (code, name, max_amount, interest_rate, max_tenure_months, required_guarantors, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
         ON CONFLICT (code) DO NOTHING`,
        [lt.code, lt.name, lt.max_amount, lt.interest_rate, lt.max_tenure_months, lt.required_guarantors, adminUserId]
      );
    }
    console.log('✅ Seeded 3 loan types');

    // ==================== 9. SEED SYSTEM SETTINGS ====================
    console.log('\n📝 Seeding system settings...');
    
    // Check if key column exists to determine insert structure
    const settingsColumns = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'system_settings'
    `);
    const hasKeyColumn = settingsColumns.rows.some(r => r.column_name === 'key');
    const hasTaxConfigColumn = settingsColumns.rows.some(r => r.column_name === 'tax_configuration');

    const taxConfig = {
      "consolidated_relief_allowance": 0,
      "gross_income_relief_percentage": 0,
      "pension_relief_percentage": 8,
      "nhf_relief_percentage": 2.5,
      "rent_relief_percentage": 60, // Assuming 60% of rent is tax exempt as per common new proposals
      "tax_brackets": [
        {"min": 0, "max": 800000, "rate": 0},
        {"min": 800000, "max": 2200000, "rate": 15},
        {"min": 2200000, "max": 9000000, "rate": 25},
        {"min": 9000000, "max": null, "rate": 30}
      ]
    };

    const approvalWorkflow = [
      {"stage": 1, "name": "Payroll Loader", "role": "payroll_loader"},
      {"stage": 2, "name": "Payroll Manager", "role": "hr_manager"},
      {"stage": 3, "name": "Audit", "role": "auditor"},
      {"stage": 4, "name": "Final Approval", "role": "approver"}
    ];

    if (hasKeyColumn) {
        if (hasTaxConfigColumn) {
             await client.query(
                `INSERT INTO system_settings (key, value, tax_configuration)
                 VALUES (
                   'general_settings',
                   $1,
                   $2
                 )
                 ON CONFLICT (key) DO NOTHING`,
                 [
                   JSON.stringify({ approval_workflow: approvalWorkflow }), 
                   JSON.stringify(taxConfig)
                 ]
            );
        } else {
            await client.query(
                `INSERT INTO system_settings (key, value)
                 VALUES (
                   'general_settings',
                   $1
                 )
                 ON CONFLICT (key) DO NOTHING`,
                 [
                   JSON.stringify({ 
                     approval_workflow: approvalWorkflow,
                     tax_configuration: taxConfig 
                   })
                 ]
            );
        }
    } else {
        await client.query(
            `INSERT INTO system_settings (id, approval_workflow, tax_configuration)
             VALUES (
               'default',
               $1,
               $2
             )
             ON CONFLICT (id) DO NOTHING`,
             [
               JSON.stringify(approvalWorkflow),
               JSON.stringify(taxConfig)
             ]
        );
    }
    console.log('✅ Seeded system settings');

    console.log('\n✅ ===== DATABASE SEEDING COMPLETE! =====\n');
    console.log('📊 Summary:');
    console.log('  ✅ 3 Users (admin, hr, accountant)');
    console.log('  ✅ 6 Departments');
    console.log('  ✅ 5 Global Allowances');
    console.log('  ✅ 3 Global Deductions');
    console.log('  ✅ 3 Sample Staff');
    console.log('  ✅ 6 Leave Types');
    console.log('  ✅ 2 Cooperatives');
    console.log('  ✅ 3 Loan Types');
    console.log('  ✅ System Settings with Tax Config');
    console.log('\n🔐 Login Credentials:');
    console.log('  Admin: admin@jsc.gov.ng / admin123');
    console.log('  HR: hr@jsc.gov.ng / hr123');
    console.log('  Accountant: accounts@jsc.gov.ng / acc123');
    console.log('\n🚀 Ready to start the server!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the seeder
seedDatabase()
  .then(() => {
    console.log('\n✅ Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  });
