# Archive Directory

## Purpose
This directory contains legacy files that have been removed from the active codebase but are preserved for historical reference.

## What's Archived Here

### 1. IndexedDB Implementation (`indexeddb.ts`)
**Archived Date**: December 26, 2024  
**Reason**: Migrated to NestJS backend with Supabase PostgreSQL database

The entire IndexedDB implementation was used during early development for client-side data storage. The system has now been fully migrated to use:
- **Backend**: NestJS API with Supabase PostgreSQL
- **Frontend**: API client calls (`/lib/api-client.ts`, `/lib/loanAPI.ts`, `/lib/bankAPI.ts`, etc.)

**Key Features That Were Replaced**:
- Local database initialization
- Client-side CRUD operations
- Index-based queries
- Data validation and relationships
- All 30+ object stores (tables)

### 2. Legacy API Wrapper (`api.ts`)
**Archived Date**: December 26, 2024  
**Reason**: Replaced with comprehensive API client modules

The old `api.ts` file was a simple wrapper around IndexedDB operations. It has been replaced with:
- `/lib/api-client.ts` - Main payroll and system APIs
- `/lib/api-staff-specific.ts` - Staff-specific operations
- `/lib/loanAPI.ts` - Cooperative and loan management
- `/lib/bankAPI.ts` - Bank payments and reconciliation
- `/lib/reportsAPI.ts` - Report generation

**Migration Path**:
```typescript
// OLD (api.ts with IndexedDB)
import { staffAPI } from '../lib/api';
const staff = await staffAPI.getAll();

// NEW (api-client.ts with backend)
import { staffAPI } from '../lib/api-client';
const staff = await staffAPI.getAllStaff();
```

## Migration History

### Phase 1: Centralize Types (✅ Complete)
- Created `/types/entities.ts` with all entity types
- Created `/constants/banks.ts` for Nigerian banks
- Updated all 26 files to use centralized types
- Removed all `db.init()` calls from components

### Phase 2: Remove Direct DB Usage (✅ Complete)
- Removed all `db.*` method calls from UI components
- Updated 4 files to use proper API client calls
- All data now flows through backend APIs

### Phase 3: Archive Legacy Files (✅ Complete)
- Moved `indexeddb.ts` to `/archive/`
- Moved `api.ts` to `/archive/`
- Created comprehensive documentation
- Verified no active imports remain

## File Inventory

| File | Original Location | Lines of Code | Purpose | Replacement |
|------|------------------|---------------|---------|-------------|
| `indexeddb.ts` | `/lib/indexeddb.ts` | ~3,500 | Client-side database | Supabase PostgreSQL + NestJS |
| `api.ts` | `/lib/api.ts` | ~800 | API wrapper for IndexedDB | `/lib/api-client.ts` + others |

## Why These Files Were Archived (Not Deleted)

1. **Historical Reference**: Understanding the evolution of the codebase
2. **Data Structures**: Original schema design can inform future decisions
3. **Migration Validation**: Compare old vs new implementations
4. **Rollback Safety**: In case of emergency rollback needs (though unlikely)
5. **Learning Resource**: Example of client-side database patterns

## Current Architecture

### Before (IndexedDB)
```
UI Components
    ↓
db.getAll() / db.add() / etc.
    ↓
IndexedDB (Browser Storage)
```

### After (NestJS + Supabase)
```
UI Components
    ↓
API Client Calls (api-client.ts, loanAPI.ts, etc.)
    ↓
NestJS Backend (113 endpoints)
    ↓
Supabase PostgreSQL Database
```

## Benefits of Migration

✅ **Centralized Data**: Single source of truth in PostgreSQL  
✅ **Multi-User Support**: Real-time synchronization  
✅ **Security**: Server-side validation and authentication  
✅ **Scalability**: Database handles millions of records  
✅ **Reliability**: ACID transactions and data integrity  
✅ **Audit Trails**: Complete history tracking  
✅ **Backup & Recovery**: Automated database backups  
✅ **Performance**: Optimized database queries  

## API Endpoint Coverage

The NestJS backend now provides **113 live API endpoints** including:

- **Payroll Management**: 15+ endpoints
- **Staff Management**: 12+ endpoints
- **Leave Management**: 8+ endpoints
- **Loan Management**: 20+ endpoints
- **Cooperative Management**: 15+ endpoints
- **Bank Payments**: 10+ endpoints
- **Arrears Engine**: 8+ endpoints
- **Promotion Management**: 6+ endpoints
- **Reports**: 10+ endpoints
- **External APIs**: 5+ endpoints
- **Notifications**: 4+ endpoints

## Type Definitions

All types previously defined in `indexeddb.ts` are now in `/types/entities.ts`:

### Core Entities
- `Staff`, `StaffRecord`, `Qualification`, `NextOfKin`, `Dependent`
- `Designation`, `GradeLevel`, `Department`, `Ministry`
- `PayrollBatch`, `PayrollLine`, `Deduction`, `Allowance`
- `LeaveType`, `LeaveRequest`, `LeaveBalance`
- `LoanType`, `LoanApplication`, `LoanDisbursement`, `LoanRepayment`
- `Cooperative`, `CooperativeMember`, `CooperativeContribution`
- `Promotion`, `PromotionArrear`, `Arrear`, `ArrearPayment`
- `PaymentBatch`, `PaymentTransaction`, `BankAccount`, `BankStatement`
- `CustomReport`, `ReportSchedule`, `Notification`
- `User`, `Role`, `Permission`, `AuditLog`

### Constants
- `NIGERIAN_BANKS` from `/constants/banks.ts`
- CONPSS salary structure (embedded in backend)

## Migration Verification

### ✅ Zero Active Imports
```bash
# Verified on: December 26, 2024
grep -r "from.*lib/indexeddb" pages/*.tsx components/*.tsx
# Result: No matches

grep -r "from.*lib/api" pages/*.tsx components/*.tsx | grep -v "api-"
# Result: No matches
```

### ✅ All API Clients Active
- `/lib/api-client.ts` - ✅ In use
- `/lib/api-staff-specific.ts` - ✅ In use
- `/lib/loanAPI.ts` - ✅ In use
- `/lib/bankAPI.ts` - ✅ In use
- `/lib/reportsAPI.ts` - ✅ In use
- `/lib/notificationAPI.ts` - ✅ In use

### ✅ Backend Integration Complete
- Authentication: ✅ Live
- Payroll Processing: ✅ Live
- Staff Management: ✅ Live
- Leave Management: ✅ Live
- Loan Management: ✅ Live
- Bank Payments: ✅ Live
- Reports: ✅ Live

## Restoration Instructions (Emergency Only)

If you need to restore these files temporarily:

```bash
# Copy from archive back to lib
cp archive/indexeddb.ts lib/
cp archive/api.ts lib/

# Revert component imports (check git history for specifics)
git log --follow pages/SomePage.tsx
git diff <commit-hash> pages/SomePage.tsx
```

**Note**: This is NOT recommended as the backend is now the source of truth.

## Related Documentation

- **Migration Plan**: `/PHASE1_COMPLETE.md`, `/PHASE2_COMPLETE.md`, `/PHASE3_COMPLETE.md`
- **API Documentation**: Backend README (NestJS project)
- **Type Definitions**: `/types/entities.ts`
- **Constants**: `/constants/banks.ts`

## Questions?

If you have questions about the migration or need to understand how something worked in the old system, review:
1. The archived files in this directory
2. Git commit history
3. Migration completion documentation
4. Backend API documentation

---

**Archive Created**: December 26, 2024  
**Last Updated**: December 26, 2024  
**Maintained By**: Development Team  
**Status**: ✅ Read-Only Reference

🎉 **Migration Complete - System is Production Ready!**
