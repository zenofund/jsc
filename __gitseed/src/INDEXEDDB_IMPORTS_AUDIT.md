# 🔍 IndexedDB Imports Audit Report

## Overview
This document identifies all files that still import or reference IndexedDB in the JSC-PMS codebase.

**Date**: December 26, 2024  
**Purpose**: Migration tracking from IndexedDB to NestJS + Supabase  
**Status**: 🟡 Backend is LIVE, but IndexedDB fallback code still exists

---

## 📊 Summary Statistics

- **Total Files with IndexedDB References**: 26 files
- **Core Library Files**: 3 files
- **Page Components**: 17 files
- **UI Components**: 4 files
- **Context Files**: 1 file
- **Entry Point**: 1 file

---

## 🔴 Critical Files (Must Update/Remove)

### 1. Core Library Files

#### `/lib/indexeddb.ts` 🔴
- **Type**: Core IndexedDB implementation
- **Lines**: ~1,741 lines
- **Status**: LEGACY - Can be archived
- **Action**: Move to `/archive/` directory
- **Reason**: Backend is now NestJS, this is no longer used (fallback only)

#### `/lib/api.ts` 🔴
- **Type**: IndexedDB API wrapper
- **Imports**: `import { db, Staff, PayrollBatch, PayrollLine, Arrears, Promotion, User, AuditTrail, Department, LeaveRequest, LeaveBalance, StaffRequest, StaffDocument, SalaryStructure } from './indexeddb';`
- **Status**: LEGACY - Can be archived
- **Action**: Move to `/archive/` directory
- **Reason**: All API calls now go through api-client.ts which uses NestJS backend

#### `/lib/api-client.ts` 🟡
- **Type**: API abstraction layer
- **Imports**: 
  - `import * as IndexedDBAPI from './api';`
  - `import { Notification } from './indexeddb';`
- **Current Backend**: `backend: 'nestjs'` ✅
- **Status**: ACTIVE - Contains fallback code
- **Action**: 
  1. Keep for now (has proper fallback logic)
  2. Remove IndexedDB fallback in future major version
- **Note**: Currently configured to use NestJS backend, IndexedDB is fallback only

---

## 🟡 Type Import Files (Type-Only Imports)

These files only import TypeScript types/interfaces from indexeddb.ts. They don't use the actual IndexedDB database.

### Page Components (17 files)

1. **`/pages/StaffListPage.tsx`** 🟡
   - Import: `import { Staff, Department } from '../lib/indexeddb';`
   - Type Usage: Type definitions only
   - Action: Move types to separate file `/types/entities.ts`

2. **`/pages/PayrollPage.tsx`** 🟡
   - Import: `import { PayrollBatch, PayrollLine } from '../lib/indexeddb';`
   - Type Usage: Type definitions only
   - Action: Move types to separate file

3. **`/pages/ArrearsPage.tsx`** 🟡
   - Import: `import { Arrears, PayrollBatch } from '../lib/indexeddb';`
   - Type Usage: Type definitions only
   - Action: Move types to separate file

4. **`/pages/AdminPage.tsx`** 🟡
   - Import: `import { User } from '../lib/indexeddb';`
   - Type Usage: Type definitions only
   - Action: Move types to separate file

5. **`/pages/PromotionsPage.tsx`** 🟡
   - Import: `import { Promotion, Staff } from '../lib/indexeddb';`
   - Type Usage: Type definitions only
   - Action: Move types to separate file

6. **`/pages/StaffPortalPage.tsx`** 🟡
   - Import: `import type { CooperativeMember, Cooperative, CooperativeContribution } from '../lib/indexeddb';`
   - Type Usage: Type definitions only (explicit type import)
   - Action: Move types to separate file

7. **`/pages/LoanManagementPage.tsx`** 🟢
   - Import: 
     - `import type { LoanType, LoanApplication, LoanDisbursement } from '../lib/indexeddb';`
     - `import { db } from '../lib/indexeddb';` ❌
   - Type Usage: Type definitions
   - DB Usage: Uses `db.getLoanApplicationsWithDetails()` ❌
   - Action: 
     - Move types to separate file
     - Replace `db.*` calls with API calls via loanAPI

8. **`/pages/DepartmentManagementPage.tsx`** 🟡
   - Import: `import { Department } from '../lib/indexeddb';`
   - Type Usage: Type definitions only
   - Action: Move types to separate file

9. **`/pages/StaffAllowancesPage.tsx`** 🟡
   - Import: `import { Staff, StaffAllowance, StaffDeduction } from '../lib/indexeddb';`
   - Type Usage: Type definitions only
   - Action: Move types to separate file

10. **`/pages/LeaveManagementPage.tsx`** 🟡
    - Import: `import { LeaveRequest } from '../lib/indexeddb';`
    - Type Usage: Type definitions only
    - Action: Move types to separate file

11. **`/pages/BankPaymentsPage.tsx`** 🟡
    - Import: `import { PayrollBatch, NIGERIAN_BANKS } from '../lib/indexeddb';`
    - Type Usage: Type definitions + constant
    - Action: 
      - Move types to separate file
      - Move NIGERIAN_BANKS to `/constants/banks.ts`

12. **`/pages/NotificationsPage.tsx`** 🟡
    - Import: `import { Notification } from '../lib/indexeddb';`
    - Type Usage: Type definitions only
    - Action: Move types to separate file

13. **`/pages/CooperativeManagementPage.tsx`** 🟡
    - Import: `import { Cooperative, CooperativeMember, CooperativeContribution, Staff } from '../lib/indexeddb';`
    - Type Usage: Type definitions only
    - Action: Move types to separate file

14. **`/pages/ApprovalsPage.tsx`** 🟢
    - Import: `import { db } from '../lib/indexeddb';` ❌
    - DB Usage: Uses `db.*` methods directly
    - Action: Replace all `db.*` calls with API client calls

15. **`/pages/ApprovalsPageEnhanced.tsx`** 🟢
    - Import: 
      - `import { db } from '../lib/indexeddb';` ❌
      - `import type { PayrollBatch, PaymentBatch, Arrear, Promotion } from '../lib/indexeddb';`
    - DB Usage: Uses `db.*` methods directly
    - Action: 
      - Replace all `db.*` calls with API client calls
      - Move types to separate file

16. **`/pages/CooperativeReportsPage.tsx`** 🟢
    - Import: 
      - `import { db } from '../lib/indexeddb';` ❌
      - `import type { Cooperative, CooperativeMember, CooperativeContribution, LoanDisbursement } from '../lib/indexeddb';`
    - DB Usage: Uses `db.getCooperativeContributions()` and other methods
    - Action: 
      - Replace all `db.*` calls with cooperativeAPI
      - Move types to separate file

17. **`/pages/CustomReportBuilderPage.tsx`** ✅
    - Import: None (uses reportsAPI)
    - Status: Clean - no IndexedDB imports

### UI Components (4 files)

1. **`/components/ViewPayrollLinesModal.tsx`** 🟡
   - Import: `import { PayrollBatch, PayrollLine } from '../lib/indexeddb';`
   - Type Usage: Type definitions only
   - Action: Move types to separate file

2. **`/components/NotificationDropdown.tsx`** 🟡
   - Import: `import { Notification } from '../lib/indexeddb';`
   - Type Usage: Type definitions only
   - Action: Move types to separate file

3. **`/components/CooperativeMembershipCard.tsx`** 🟡
   - Import: `import type { CooperativeMember, Cooperative } from '../lib/indexeddb';`
   - Type Usage: Type definitions only (explicit type import)
   - Action: Move types to separate file

4. **`/components/MergeArrearsModal.tsx`** 🟡
   - Import: `import { Arrears, PayrollBatch } from '../lib/indexeddb';`
   - Type Usage: Type definitions only
   - Action: Move types to separate file

### Context Files (1 file)

1. **`/contexts/AuthContext.tsx`** 🟡
   - Import: `import { User } from '../lib/indexeddb';`
   - Type Usage: Type definitions only
   - Action: Move types to separate file

### Entry Point (1 file)

1. **`/App.tsx`** 🟢
   - Import: `import { db } from './lib/indexeddb';` ❌
   - DB Usage: `db.init()` called in useEffect
   - Action: Remove - DB initialization now happens in backend
   - Note: This is preventing IndexedDB from being fully removed

---

## 🎯 Action Plan

### Phase 1: Move Type Definitions (Priority: HIGH)

Create `/types/entities.ts` with all type definitions:

```typescript
// /types/entities.ts
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department_id?: string;
  staff_id?: string;
  status: string;
  last_login?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface Staff {
  id: string;
  staff_number: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  phone_number: string;
  date_of_birth: Date;
  gender: 'Male' | 'Female';
  // ... all other staff fields
}

export interface PayrollBatch {
  id: string;
  batch_number: string;
  payroll_month: string;
  payroll_year: number;
  // ... all other payroll fields
}

// ... all other types
```

Create `/constants/banks.ts`:

```typescript
// /constants/banks.ts
export const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '063', name: 'Access Bank (Diamond)' },
  // ... all banks
];
```

**Files to Update** (Replace imports):
- All 17 page components
- All 4 UI components  
- 1 context file
- `/lib/api-client.ts`

**Find & Replace**:
```
OLD: import { User, Staff, ... } from '../lib/indexeddb';
NEW: import { User, Staff, ... } from '../types/entities';

OLD: import { NIGERIAN_BANKS } from '../lib/indexeddb';
NEW: import { NIGERIAN_BANKS } from '../constants/banks';
```

---

### Phase 2: Remove Direct DB Usage (Priority: HIGH)

#### Files Using `db.*` directly:

1. **`/App.tsx`** 
   ```typescript
   // REMOVE THIS:
   useEffect(() => {
     db.init();
   }, []);
   ```
   
   **Reason**: Backend handles database initialization now

2. **`/pages/ApprovalsPage.tsx`**
   - Replace all `db.*` calls with `payrollAPI.*` calls
   - Example:
     ```typescript
     // OLD:
     const batches = await db.getPendingPayrollBatches();
     
     // NEW:
     const batches = await payrollAPI.getPendingBatches();
     ```

3. **`/pages/ApprovalsPageEnhanced.tsx`**
   - Replace all `db.*` calls with appropriate API calls
   - Use: `payrollAPI`, `arrearsAPI`, `promotionAPI`, `paymentBatchAPI`

4. **`/pages/LoanManagementPage.tsx`**
   - Replace `db.getLoanApplicationsWithDetails()` with `loanApplicationAPI.getAll()`

5. **`/pages/CooperativeReportsPage.tsx`**
   - Replace `db.getCooperativeContributions()` with `cooperativeAPI.getContributions()`
   - Replace other `db.*` calls with `cooperativeAPI.*`

---

### Phase 3: Archive Legacy Files (Priority: MEDIUM)

Create `/archive/` directory and move:

1. `/lib/indexeddb.ts` → `/archive/indexeddb.ts`
2. `/lib/api.ts` → `/archive/api-indexeddb.ts`

Update `/archive/README.md`:
```markdown
# Archived Files

These files are legacy IndexedDB implementations that have been replaced by NestJS + Supabase backend.

- **indexeddb.ts** - Original IndexedDB database layer (replaced by Supabase)
- **api-indexeddb.ts** - Original API wrapper for IndexedDB (replaced by api-client.ts)

**Last Active**: December 2024  
**Replaced By**: NestJS backend at `/backend`
```

---

### Phase 4: Clean Up API Client (Priority: LOW)

In `/lib/api-client.ts`:

1. **Keep the fallback logic** for now (defensive programming)
2. Add deprecation warning when IndexedDB backend is used:
   ```typescript
   if (API_CONFIG.backend === 'indexeddb') {
     console.warn('⚠️ DEPRECATED: Using IndexedDB fallback. Please configure NestJS backend.');
     return IndexedDBAPI.authAPI.login(email, password);
   }
   ```

3. In future major version (v2.0), remove IndexedDB fallback entirely

---

## 📋 Migration Checklist

### Type Definitions
- [ ] Create `/types/entities.ts` with all types
- [ ] Create `/constants/banks.ts` with NIGERIAN_BANKS
- [ ] Update all 17 page components imports
- [ ] Update all 4 UI component imports
- [ ] Update context file import
- [ ] Update `/lib/api-client.ts` import

### Direct DB Usage
- [ ] Remove `db.init()` from `/App.tsx`
- [ ] Replace `db.*` in `/pages/ApprovalsPage.tsx`
- [ ] Replace `db.*` in `/pages/ApprovalsPageEnhanced.tsx`
- [ ] Replace `db.*` in `/pages/LoanManagementPage.tsx`
- [ ] Replace `db.*` in `/pages/CooperativeReportsPage.tsx`

### Archive Legacy
- [ ] Create `/archive/` directory
- [ ] Move `/lib/indexeddb.ts` to archive
- [ ] Move `/lib/api.ts` to archive
- [ ] Create `/archive/README.md`

### Testing
- [ ] Test all pages load correctly
- [ ] Test all API calls work
- [ ] Test type safety maintained
- [ ] Test no console errors
- [ ] Test build succeeds

### Documentation
- [ ] Update architecture documentation
- [ ] Update developer onboarding guide
- [ ] Add migration notes to CHANGELOG

---

## 🚨 Breaking Changes

### None Expected
This migration should be **non-breaking** because:
1. Type definitions remain the same (just moved to new file)
2. API client already uses NestJS backend
3. Direct `db.*` calls are rare and will be replaced with existing API methods

### If Breaking Changes Occur
If you encounter issues:
1. Temporarily revert type imports: `from '../types/entities'` → `from '../lib/indexeddb'`
2. Keep IndexedDB files in place temporarily
3. Report specific file/line causing issue

---

## 📊 Progress Tracking

| Phase | Status | Files Remaining | Priority |
|-------|--------|-----------------|----------|
| Phase 1: Type Migration | 🔴 Not Started | 23 files | HIGH |
| Phase 2: Remove DB Usage | 🔴 Not Started | 5 files | HIGH |
| Phase 3: Archive Legacy | 🔴 Not Started | 2 files | MEDIUM |
| Phase 4: Clean API Client | 🔴 Not Started | 1 file | LOW |

---

## 🎯 Quick Start - Type Migration Script

Run this script to automatically update imports:

```bash
#!/bin/bash
# migrate-types.sh

# Update page components
find ./pages -name "*.tsx" -type f -exec sed -i \
  's/from '\''\.\.\/lib\/indexeddb'\'';/from '\''\.\.\/types\/entities'\'';/g' {} \;

# Update UI components
find ./components -name "*.tsx" -type f -exec sed -i \
  's/from '\''\.\.\/lib\/indexeddb'\'';/from '\''\.\.\/types\/entities'\'';/g' {} \;

# Update contexts
find ./contexts -name "*.tsx" -type f -exec sed -i \
  's/from '\''\.\.\/lib\/indexeddb'\'';/from '\''\.\.\/types\/entities'\'';/g' {} \;

echo "✅ Type imports updated!"
echo "⚠️  Manual review required for:"
echo "  - /lib/api-client.ts"
echo "  - /App.tsx (remove db.init())"
```

---

## 🔍 Files by Category

### ✅ Clean Files (No IndexedDB)
- `/pages/CustomReportBuilderPage.tsx`
- `/pages/ReportsListPage.tsx`
- `/pages/DashboardPage.tsx` (assumed clean)
- Most UI components

### 🟡 Type Import Only (23 files)
- 17 page components
- 4 UI components
- 1 context file
- 1 API client file

### 🟢 Direct DB Usage (5 files)
- `/App.tsx`
- `/pages/ApprovalsPage.tsx`
- `/pages/ApprovalsPageEnhanced.tsx`
- `/pages/LoanManagementPage.tsx`
- `/pages/CooperativeReportsPage.tsx`

### 🔴 Legacy Core (3 files)
- `/lib/indexeddb.ts`
- `/lib/api.ts`
- `/lib/api-client.ts` (partial)

---

## 💡 Recommendations

1. **Start with Type Migration** (Phase 1)
   - Low risk, high impact
   - Easy to test
   - Unblocks other work

2. **Remove Direct DB Usage** (Phase 2)
   - Higher risk, requires testing
   - Use existing API methods
   - Test each page individually

3. **Archive When Confident** (Phase 3)
   - Keep in archive folder (not deleted)
   - Can always restore if needed
   - Good for code archaeology

4. **Clean API Client Later** (Phase 4)
   - Low priority
   - Fallback logic is harmless
   - Can wait for v2.0 release

---

## 📞 Support

If you encounter issues during migration:
1. Check file in audit report above
2. Look for similar files already migrated
3. Test incrementally (one file at a time)
4. Keep git history for easy rollback

---

**Last Updated**: December 26, 2024  
**Status**: ✅ Audit Complete - Ready for Migration  
**Next Step**: Start Phase 1 - Type Definitions Migration
