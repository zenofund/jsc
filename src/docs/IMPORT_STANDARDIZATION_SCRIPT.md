# API Import Standardization - Quick Reference

## Overview
This document provides a quick checklist and find-replace commands to standardize all API imports to use `/lib/api-client.ts`.

---

## Quick Stats

- **Total Files to Update:** 12
- **Total Find-Replace Operations:** 12
- **Estimated Time:** 15-30 minutes
- **Risk Level:** LOW (import path changes only)
- **Testing Required:** Smoke test each page after update

---

## Files to Update (In Priority Order)

### 1. Authentication Layer (Critical)
- [ ] `/contexts/AuthContext.tsx`

### 2. Dashboard Pages (High Traffic)
- [ ] `/pages/DashboardPage.tsx`
- [ ] `/pages/HRDashboardPage.tsx`

### 3. Core Operations (Critical Business Logic)
- [ ] `/pages/PayrollPage.tsx`
- [ ] `/pages/ArrearsPage.tsx`
- [ ] `/pages/ApprovalsPage.tsx`

### 4. Staff & HR (Moderate Priority)
- [ ] `/pages/StaffPortalPage.tsx`
- [ ] `/pages/PromotionsPage.tsx`
- [ ] `/pages/LeaveManagementPage.tsx`

### 5. Reporting & Admin (Lower Priority)
- [ ] `/pages/PayslipsPage.tsx`
- [ ] `/pages/ReportsPage.tsx`
- [ ] `/pages/AdminPage.tsx`

---

## Find & Replace Commands

### File 1: `/contexts/AuthContext.tsx`
```bash
# FIND:
import { authAPI } from '../lib/api';

# REPLACE:
import { authAPI } from '../lib/api-client';
```

### File 2: `/pages/DashboardPage.tsx`
```bash
# FIND:
import { dashboardAPI } from '../lib/api';

# REPLACE:
import { dashboardAPI } from '../lib/api-client';
```

### File 3: `/pages/HRDashboardPage.tsx`
```bash
# FIND:
import { dashboardAPI, staffAPI, staffPortalAPI, departmentAPI } from '../lib/api';

# REPLACE:
import { dashboardAPI, staffAPI, staffPortalAPI, departmentAPI } from '../lib/api-client';
```

### File 4: `/pages/PayrollPage.tsx`
```bash
# FIND:
import { payrollAPI } from '../lib/api';

# REPLACE:
import { payrollAPI } from '../lib/api-client';
```

### File 5: `/pages/ArrearsPage.tsx`
```bash
# FIND:
import { arrearsAPI, payrollAPI } from '../lib/api';

# REPLACE:
import { arrearsAPI, payrollAPI } from '../lib/api-client';
```

### File 6: `/pages/ApprovalsPage.tsx`
```bash
# FIND:
import { payrollAPI } from '../lib/api';

# REPLACE:
import { payrollAPI } from '../lib/api-client';
```

### File 7: `/pages/StaffPortalPage.tsx`
```bash
# FIND:
import { staffPortalAPI, staffAPI, payslipAPI, promotionAPI } from '../lib/api';

# REPLACE:
import { staffPortalAPI, staffAPI, payslipAPI, promotionAPI } from '../lib/api-client';
```

### File 8: `/pages/PromotionsPage.tsx`
```bash
# FIND:
import { promotionAPI, staffAPI } from '../lib/api';

# REPLACE:
import { promotionAPI, staffAPI } from '../lib/api-client';
```

### File 9: `/pages/LeaveManagementPage.tsx`
```bash
# FIND:
import { staffPortalAPI } from '../lib/api';

# REPLACE:
import { staffPortalAPI } from '../lib/api-client';
```

### File 10: `/pages/PayslipsPage.tsx`
```bash
# FIND:
import { payslipAPI, staffAPI, payrollAPI } from '../lib/api';

# REPLACE:
import { payslipAPI, staffAPI, payrollAPI } from '../lib/api-client';
```

### File 11: `/pages/ReportsPage.tsx`
```bash
# FIND:
import { reportAPI, payrollAPI } from '../lib/api';

# REPLACE:
import { reportAPI, payrollAPI } from '../lib/api-client';
```

### File 12: `/pages/AdminPage.tsx`
```bash
# FIND:
import { userAPI, settingsAPI, auditAPI } from '../lib/api';

# REPLACE:
import { userAPI, settingsAPI, auditAPI } from '../lib/api-client';
```

---

## Automated Script (Bash)

```bash
#!/bin/bash

# API Import Standardization Script
# Run from project root directory

echo "🚀 Starting API import standardization..."

# File 1
sed -i "s/from '..\/lib\/api'/from '..\/lib\/api-client'/g" contexts/AuthContext.tsx

# File 2
sed -i "s/from '..\/lib\/api'/from '..\/lib\/api-client'/g" pages/DashboardPage.tsx

# File 3
sed -i "s/from '..\/lib\/api'/from '..\/lib\/api-client'/g" pages/HRDashboardPage.tsx

# File 4
sed -i "s/from '..\/lib\/api'/from '..\/lib\/api-client'/g" pages/PayrollPage.tsx

# File 5
sed -i "s/from '..\/lib\/api'/from '..\/lib\/api-client'/g" pages/ArrearsPage.tsx

# File 6
sed -i "s/from '..\/lib\/api'/from '..\/lib\/api-client'/g" pages/ApprovalsPage.tsx

# File 7
sed -i "s/from '..\/lib\/api'/from '..\/lib\/api-client'/g" pages/StaffPortalPage.tsx

# File 8
sed -i "s/from '..\/lib\/api'/from '..\/lib\/api-client'/g" pages/PromotionsPage.tsx

# File 9
sed -i "s/from '..\/lib\/api'/from '..\/lib\/api-client'/g" pages/LeaveManagementPage.tsx

# File 10
sed -i "s/from '..\/lib\/api'/from '..\/lib\/api-client'/g" pages/PayslipsPage.tsx

# File 11
sed -i "s/from '..\/lib\/api'/from '..\/lib\/api-client'/g" pages/ReportsPage.tsx

# File 12
sed -i "s/from '..\/lib\/api'/from '..\/lib\/api-client'/g" pages/AdminPage.tsx

echo "✅ Import standardization complete!"
echo "📋 Please run smoke tests on all pages"
```

---

## Manual Testing Checklist

After running the script, test each page:

### Authentication
- [ ] Login works
- [ ] Logout works
- [ ] Password change works

### Dashboards
- [ ] Main Dashboard loads
- [ ] HR Dashboard loads (hr_manager role)
- [ ] Cashier Dashboard loads (cashier role)

### Core Operations
- [ ] Payroll page loads and displays batches
- [ ] Can create new payroll batch
- [ ] Can submit for approval
- [ ] Arrears page loads
- [ ] Approvals page works

### Staff & HR
- [ ] Staff Portal loads (staff role)
- [ ] Leave requests work
- [ ] Promotions page works
- [ ] Leave Management works

### Reporting
- [ ] Payslips page loads
- [ ] Reports generate correctly
- [ ] Admin page loads

---

## Verification Commands

### 1. Check for remaining direct imports:
```bash
grep -r "from '../lib/api'" pages/
grep -r "from '../lib/api'" contexts/
```

**Expected Output:** No matches (or only comments)

### 2. Verify all files use api-client:
```bash
grep -r "from '../lib/api-client'" pages/ | wc -l
```

**Expected Output:** Should show count of pages using api-client

### 3. Check for any import errors:
```bash
npm run build
# or
yarn build
```

**Expected:** Build completes successfully

---

## Rollback Plan

If issues are encountered:

### Quick Rollback (Bash):
```bash
#!/bin/bash

echo "🔄 Rolling back API imports..."

# Rollback all files
sed -i "s/from '..\/lib\/api-client'/from '..\/lib\/api'/g" contexts/AuthContext.tsx
sed -i "s/from '..\/lib\/api-client'/from '..\/lib\/api'/g" pages/DashboardPage.tsx
sed -i "s/from '..\/lib\/api-client'/from '..\/lib\/api'/g" pages/HRDashboardPage.tsx
sed -i "s/from '..\/lib\/api-client'/from '..\/lib\/api'/g" pages/PayrollPage.tsx
sed -i "s/from '..\/lib\/api-client'/from '..\/lib\/api'/g" pages/ArrearsPage.tsx
sed -i "s/from '..\/lib\/api-client'/from '..\/lib\/api'/g" pages/ApprovalsPage.tsx
sed -i "s/from '..\/lib\/api-client'/from '..\/lib\/api'/g" pages/StaffPortalPage.tsx
sed -i "s/from '..\/lib\/api-client'/from '..\/lib\/api'/g" pages/PromotionsPage.tsx
sed -i "s/from '..\/lib\/api-client'/from '..\/lib\/api'/g" pages/LeaveManagementPage.tsx
sed -i "s/from '..\/lib\/api-client'/from '..\/lib\/api'/g" pages/PayslipsPage.tsx
sed -i "s/from '..\/lib\/api-client'/from '..\/lib\/api'/g" pages/ReportsPage.tsx
sed -i "s/from '..\/lib\/api-client'/from '..\/lib\/api'/g" pages/AdminPage.tsx

echo "✅ Rollback complete"
```

### Git Rollback:
```bash
git checkout -- contexts/AuthContext.tsx
git checkout -- pages/*.tsx
```

---

## Post-Migration Benefits

Once complete, you will have:

✅ **Single Source of Truth** - All API calls go through api-client.ts  
✅ **Easy Migration** - Change one file (api-client.ts) to switch to Supabase  
✅ **Better Testing** - Mock api-client.ts instead of 12+ files  
✅ **Code Consistency** - All pages follow same pattern  
✅ **Reduced Risk** - Centralized error handling and logging  
✅ **Production Ready** - Clean architecture for scaling  

---

## Next Steps After Standardization

1. **Add ESLint Rule** to prevent future direct imports:
```javascript
// .eslintrc.js
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": ["**/lib/api", "!**/lib/api-client"]
    }]
  }
}
```

2. **Update Documentation** - Mark this task as complete

3. **Create Migration Plan** for Supabase implementation

4. **Set Up Environment Variables** for production

---

**Ready to execute?** Use the automated script above or manually update each file.

**Questions?** Refer to `/docs/API_AUDIT_AND_PRODUCTION_READINESS.md`
