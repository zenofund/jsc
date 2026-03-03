# JSC Payroll Management System - Technical Documentation

## System Overview

This is a comprehensive Payroll Management System built for the Judicial Service Committee (JSC) using:
- **Frontend**: React + TypeScript + Tailwind CSS
- **Local Database**: IndexedDB (simulating backend)
- **Production Ready**: Designed for migration to Supabase

## Database Schema (IndexedDB)

### Core Entities

1. **staff** - Employee records
   - Bio data, next of kin, appointment details
   - Salary information, bank details
   - Staff number format: JSC/YYYY/0001

2. **salary_structures** - Salary grade tables
   - 17 Grade Levels x 15 Steps matrix
   - CONMESS 2024 structure implemented

3. **allowances** - Salary allowances
   - Types: Fixed, Percentage, Grade-based
   - Taxable/Pensionable flags

4. **deductions** - Salary deductions
   - Pension (8%), Tax (7%), Cooperative, etc.

5. **promotions** - Staff promotions
   - Auto-triggers arrears calculation
   - Backdated effective dates supported

6. **payroll_batches** - Monthly payroll runs
   - Multi-stage approval workflow
   - Locking mechanism

7. **payroll_lines** - Individual staff payroll records
   - Calculated earnings and deductions
   - Arrears integration

8. **arrears** - Salary arrears tracking
   - Auto-detected from promotions
   - Month-by-month breakdown

9. **workflow_approvals** - Approval stages
   - 4-stage workflow (configurable)

10. **users** - System users
    - Role-based access control

11. **audit_trail** - Complete audit log
    - All CRUD operations logged

## Key Features Implemented

### 1. Staff Management
- Multi-step staff onboarding (4 steps)
- Bio data, next of kin, appointment, salary
- Auto-generated staff numbers
- Activate/deactivate staff

### 2. Payroll Processing
**Workflow**:
1. Create Batch (select month)
2. Generate Lines (auto-calculate for all active staff)
3. Review & Adjust
4. Submit for Approval
5. Multi-level Approval
6. Lock & Export

**Features**:
- Automatic salary calculation
- Allowances and deductions
- Arrears integration
- Export to CSV/Remita format

### 3. Arrears Engine
**Auto-Detection**:
- Backdated promotions
- Salary structure updates
- Step increment delays
- Missed payroll updates

**Workflow**:
1. Auto-detect arrears
2. Calculate month-by-month
3. Approve arrears
4. Merge to payroll batch

### 4. Multi-Level Approval Workflow
**Default Stages**:
1. Unit Head Review (Reviewer)
2. Director Admin Approval (Approver)
3. Permanent Secretary Approval (Approver)
4. Auditor Review (Auditor - read-only)

**Features**:
- Role-based stage access
- Comments and activity log
- Approve/Reject with reasons
- Complete audit trail

### 5. Audit Trail
- All create, update, delete operations
- Old values vs new values
- User attribution
- Timestamp tracking

## User Roles & Permissions

### Admin
- Full system access
- User management
- System configuration
- Salary structure setup

### Payroll Officer
- Create/manage staff
- Run payroll
- Manage arrears
- View reports

### Reviewer
- Review payroll batches (Stage 1)
- View staff records

### Approver
- Approve payroll batches (Stages 2-3)
- View all payroll data

### Auditor
- Read-only access to all data
- Final review stage
- Audit trail access

### Staff (Self-service)
- View own payslips
- Update bank details (with approval)
- View personal profile

## Default Test Accounts

```
Admin:
- Email: admin@jsc.gov.ng
- Password: admin123

Payroll Officer:
- Email: payroll@jsc.gov.ng
- Password: payroll123

Approver:
- Email: approver@jsc.gov.ng
- Password: approver123
```

## API Endpoints (IndexedDB Layer)

### Staff APIs
- `staffAPI.createStaff()` - Create new staff
- `staffAPI.updateStaff()` - Update staff record
- `staffAPI.getAllStaff()` - Get all staff
- `staffAPI.getActiveStaff()` - Get active staff only
- `staffAPI.deactivateStaff()` - Deactivate staff
- `staffAPI.getNextStaffNumber()` - Generate next staff number

### Payroll APIs
- `payrollAPI.createPayrollBatch()` - Create new batch
- `payrollAPI.generatePayrollLines()` - Generate payroll lines
- `payrollAPI.submitForApproval()` - Submit to workflow
- `payrollAPI.approvePayrollStage()` - Approve stage
- `payrollAPI.rejectPayrollStage()` - Reject stage
- `payrollAPI.lockPayroll()` - Lock batch
- `payrollAPI.getPayrollLines()` - Get batch lines
- `payrollAPI.getStaffPayrollHistory()` - Get staff history

### Promotion APIs
- `promotionAPI.createPromotion()` - Create promotion
- `promotionAPI.approvePromotion()` - Approve promotion
- `promotionAPI.calculatePromotionArrears()` - Calculate arrears

### Arrears APIs
- `arrearsAPI.getPendingArrears()` - Get pending arrears
- `arrearsAPI.approveArrears()` - Approve arrears
- `arrearsAPI.mergeArrearsToPayroll()` - Merge to batch

### Audit APIs
- `auditAPI.getAuditTrail()` - Get filtered audit logs

## Migration to Supabase

### Database Migration
All IndexedDB stores map to Supabase tables:

```sql
-- Enable Row Level Security
CREATE TABLE staff (...)
CREATE TABLE salary_structures (...)
CREATE TABLE allowances (...)
-- etc.

-- Add RLS policies based on user roles
```

### API Migration
Replace IndexedDB calls with Supabase client:

```typescript
// Before (IndexedDB)
await db.create('staff', staffData);

// After (Supabase)
await supabase.from('staff').insert(staffData);
```

### Authentication Migration
Replace localStorage auth with Supabase Auth:

```typescript
// Before
localStorage.setItem('jsc_user', JSON.stringify(user));

// After
const { user, error } = await supabase.auth.signIn({
  email,
  password
});
```

## Offline Support

The system uses IndexedDB which works offline by default. For production:

1. Implement sync queue for offline changes
2. Show sync status indicator
3. Handle conflicts on reconnection

## Security Considerations

⚠️ **Important**: This prototype uses:
- Plain text passwords (use bcrypt/Supabase Auth in production)
- Local storage for session (use httpOnly cookies in production)
- No data encryption (use Supabase RLS + encryption in production)

**This system is for demonstration and internal testing only.**

## Deployment Checklist

- [ ] Migrate database to Supabase
- [ ] Implement proper authentication
- [ ] Set up Row Level Security policies
- [ ] Add data encryption
- [ ] Implement backup strategy
- [ ] Add email notifications
- [ ] Set up monitoring and logging
- [ ] Conduct security audit
- [ ] User acceptance testing
- [ ] Training for administrators

## Technical Support

For issues or questions:
- Review audit trail for data operations
- Check browser console for IndexedDB errors
- Verify user roles and permissions
- Test with default accounts first

## Future Enhancements

- [ ] Payslip PDF generation
- [ ] Email notifications for approvals
- [ ] Bulk staff upload (CSV)
- [ ] Advanced reporting and analytics
- [ ] Mobile app (React Native)
- [ ] Biometric authentication
- [ ] Integration with bank APIs
- [ ] Pension remittance automation
- [ ] Tax remittance automation
- [ ] Document management system
