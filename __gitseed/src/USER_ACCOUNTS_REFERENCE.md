# JSC-PMS User Account Credentials

## 📋 Complete User Account Reference

This document contains all user accounts created for the JSC-PMS system during development.

**Last Updated**: December 26, 2024  
**Status**: ✅ Password hashing issue FIXED

---

## ⚠️ IMPORTANT: Password Hash Fix Applied

**Issue Resolved**: The seed scripts were using the wrong column name (`password` instead of `password_hash`) and attempting to insert into a non-existent `is_active` column.

**Fix Applied**:
- ✅ Updated `/backend/src/database/seeds/seed-initial-data.ts` to use `password_hash` column
- ✅ Updated `/database/seeds.sql` with correct column names and updated password documentation
- ✅ Removed `is_active` column reference (using `status` instead)

**To Apply Fix**:
```bash
cd backend
npm run db:seed
```

---

## Primary Accounts (From Seed File)

### 1. **System Administrator**
- **Email**: `admin@jsc.gov.ng`
- **Password**: `admin123`
- **Role**: Admin
- **Full Name**: System Administrator
- **Permissions**: Full system access, all modules, user management, system configuration

### 2. **HR Manager**
- **Email**: `hr@jsc.gov.ng`
- **Password**: `hr123`
- **Role**: HR
- **Full Name**: HR Manager
- **Permissions**: Staff management, leave management, promotions, HR reports

### 3. **Chief Accountant**
- **Email**: `accounts@jsc.gov.ng`
- **Password**: `acc123`
- **Role**: Accountant
- **Full Name**: Chief Accountant
- **Permissions**: Payroll processing, financial reports, deductions, bank payments

---

## Additional Documented Accounts

### 4. **Payroll Officer** (From Documentation)
- **Email**: `payroll@jsc.gov.ng`
- **Password**: `payroll123` or `password123`
- **Role**: Payroll Officer
- **Permissions**: Payroll batch creation, payroll line generation, staff payroll data

### 5. **Approver** (From Documentation)
- **Email**: `approver@jsc.gov.ng`
- **Password**: `approver123`
- **Role**: Approver
- **Permissions**: Multi-level approval workflows (Stages 2-3), payroll batch approval

---

## Summary Table

| Role | Email | Password | Created By |
|------|-------|----------|------------|
| **Admin** | admin@jsc.gov.ng | admin123 | Seed Script |
| **HR** | hr@jsc.gov.ng | hr123 | Seed Script |
| **Accountant** | accounts@jsc.gov.ng | acc123 | Seed Script |
| Payroll Officer | payroll@jsc.gov.ng | payroll123 | Documentation |
| Approver | approver@jsc.gov.ng | approver123 | Documentation |

---

## Role Permissions Overview

### **Admin**
- ✅ Full system access
- ✅ User management (create, edit, deactivate users)
- ✅ System configuration (salary structures, allowances, deductions)
- ✅ All module access
- ✅ Audit trail access
- ✅ Report generation (all types)
- ✅ SMTP settings management
- ✅ External API configuration
- ✅ Cooperative management

### **HR**
- ✅ Staff onboarding and management
- ✅ Leave management
- ✅ Promotion processing
- ✅ Department management
- ✅ Staff-specific allowances/deductions
- ✅ HR reports
- ✅ Staff data export
- ⛔ Limited payroll access (view only)

### **Accountant**
- ✅ Payroll processing
- ✅ Payroll batch management
- ✅ Financial reports
- ✅ Tax calculations
- ✅ Deductions management
- ✅ Bank payment processing
- ✅ Payslip generation
- ⛔ Cannot modify staff records

### **Payroll Officer**
- ✅ Payroll batch creation
- ✅ Payroll line generation
- ✅ Salary calculations
- ✅ Payslip generation
- ✅ Payroll reports
- ⛔ Cannot approve batches
- ⛔ Limited configuration access

### **Approver**
- ✅ Multi-level approval workflows
- ✅ Approve/reject payroll batches
- ✅ View payroll data
- ✅ Review staff information
- ⛔ Cannot create or modify payroll
- ⛔ Cannot modify system configuration

### **Reviewer**
- ✅ Stage 1 approval (Unit Head level)
- ✅ Review payroll batches
- ✅ View staff records
- ⛔ Cannot final-approve batches

### **Auditor**
- ✅ Read-only access to all payroll data
- ✅ Audit trail review
- ✅ Financial reports
- ✅ Compliance checking
- ⛔ Cannot modify any data

### **Cashier**
- ✅ Bank payment file generation
- ✅ Payment confirmation
- ✅ Payment status tracking
- ✅ Bank integration reports
- ⛔ Cannot modify payroll calculations
- ⛔ Cannot approve batches

### **Staff** (Self-Service Portal)
- ✅ View personal information
- ✅ View payslips
- ✅ View leave balance
- ✅ View loan information
- ✅ View cooperative membership
- ⛔ Cannot modify own records

---

## Password Security Notes

⚠️ **IMPORTANT FOR PRODUCTION:**

1. **Change All Default Passwords** immediately after deployment
2. **Enforce Strong Passwords**: Minimum 8 characters, mixed case, numbers, special characters
3. **Enable Password Expiry**: Force password changes every 90 days
4. **Use 2FA** (Two-Factor Authentication) for sensitive roles (Admin, Accountant, Approver)
5. **Audit Failed Login Attempts**: Monitor for brute force attacks
6. **Disable Unused Accounts**: Deactivate test accounts in production

---

## Password Recovery System

The system includes a complete password recovery workflow:

1. User clicks "Forgot Password" on login page
2. Enters registered email address
3. System sends reset token via SMTP email
4. User clicks link in email
5. User enters new password
6. System validates token and updates password

**Reset Token**: Valid for 1 hour, single use only.

---

## Creating New Users

### Via Admin Dashboard:
1. Login as Admin
2. Navigate to **Admin Panel** → **User Management**
3. Click **Add User**
4. Fill in details:
   - Email
   - Full Name
   - Role
   - Initial Password (user can change after first login)
5. Save

### Via API:
```bash
POST /api/v1/users
Authorization: Bearer {admin_token}

{
  "email": "newuser@jsc.gov.ng",
  "password": "temporary123",
  "full_name": "New User Name",
  "role": "Payroll Officer",
  "is_active": true,
  "force_password_change": true
}
```

---

## Testing Quick Login

### Using cURL:
```bash
# Admin Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@jsc.gov.ng","password":"admin123"}'

# HR Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hr@jsc.gov.ng","password":"hr123"}'

# Accountant Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"accounts@jsc.gov.ng","password":"acc123"}'
```

### Via Frontend:
1. Navigate to `http://localhost:5173` (React app)
2. Enter email and password from table above
3. Click **Login**
4. System redirects to role-appropriate dashboard

---

## Database Seed Script Location

**File**: `/backend/src/database/seeds/seed-initial-data.ts`

**Run Seeder**:
```bash
cd backend
npm run seed
```

**Seeder Creates**:
- ✅ 3 default users (Admin, HR, Accountant)
- ✅ 5 departments
- ✅ Sample CONPSS salary structure (17 levels, 15 steps each)
- ✅ Standard allowances (Housing, Transport, Medical, etc.)
- ✅ Standard deductions (Tax, Pension, NHF, etc.)
- ✅ Approval workflow stages

---

## Security Best Practices

### For Development:
- ✅ Use simple passwords (admin123, hr123, etc.)
- ✅ Document all credentials clearly
- ✅ Keep separate development database

### For Production:
- ⚠️ **Never commit passwords** to version control
- ⚠️ Use environment variables for sensitive data
- ⚠️ Enable HTTPS/SSL for all connections
- ⚠️ Implement rate limiting on login endpoints
- ⚠️ Log all authentication attempts
- ⚠️ Use secure session management (JWT with expiry)
- ⚠️ Implement IP whitelisting for admin accounts
- ⚠️ Regular security audits and penetration testing

---

## Current Password Hashing

**Algorithm**: bcrypt  
**Salt Rounds**: 10  
**Hash Example**:
```
Plain: admin123
Hash: $2b$10$YourActualHashedPasswordHereFromBcrypt
```

---

## Contact & Support

For password resets or account issues:
- **Admin Support**: Contact system administrator
- **Technical Issues**: Check audit logs in Admin Panel
- **Production Support**: Contact IT Help Desk

---

**Document Created**: December 26, 2024  
**Last Updated**: December 26, 2024  
**System**: JSC-PMS (Judicial Service Committee Payroll Management System)  
**Environment**: Development/Testing