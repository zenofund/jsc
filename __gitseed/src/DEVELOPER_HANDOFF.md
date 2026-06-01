# Developer Handoff Notes - JSC Payroll Management System

## Project Structure

```
/
├── lib/
│   ├── indexeddb.ts          # Complete database schema & IndexedDB service
│   └── api.ts                # All API endpoints (simulated with IndexedDB)
├── contexts/
│   └── AuthContext.tsx       # Authentication state management
├── components/
│   ├── Layout.tsx            # Main layout with sidebar navigation
│   ├── Breadcrumb.tsx        # Breadcrumb navigation
│   ├── StatusBadge.tsx       # Status indicator component
│   ├── DataTable.tsx         # Reusable table with pagination & search
│   ├── Modal.tsx             # Modal dialog component
│   ├── Toast.tsx             # Toast notification system
│   └── Stepper.tsx           # Multi-step form stepper
├── pages/
│   ├── LoginPage.tsx         # Authentication page
│   ├── DashboardPage.tsx     # Main dashboard
│   ├── StaffListPage.tsx     # Staff management (CRUD)
│   ├── PayrollPage.tsx       # Payroll processing
│   ├── ArrearsPage.tsx       # Arrears management
│   └── ApprovalsPage.tsx     # Approval workflow
├── App.tsx                   # Main app component & routing
├── README.md                 # User documentation
├── SYSTEM_GUIDE.md           # Technical documentation
└── DEVELOPER_HANDOFF.md      # This file
```

## Architecture Overview

### Frontend Architecture
- **React 18** with TypeScript for type safety
- **Context API** for global state (Auth, Toast)
- **Component composition** for reusability
- **Tailwind CSS v4** for styling
- **Lucide React** for icons

### Data Layer (IndexedDB)
- **Local-first architecture**: All data stored in browser
- **12 object stores** (tables) with proper indexing
- **Transaction-based operations** for data integrity
- **Auto-initialization** on first load
- **Seed data** for testing

### Navigation System
Custom navigation using global state:
```typescript
(window as any).navigateTo('dashboard');
```

This was chosen over React Router to simplify the prototype while maintaining full functionality.

## Key Implementation Details

### 1. Database Initialization

**File**: `/lib/indexeddb.ts`

```typescript
// On app load, database is initialized:
await db.init();           // Creates all stores
await db.seedInitialData(); // Seeds default users, salary structure, etc.
```

**Important**: IndexedDB version is set to `1`. If you modify the schema:
1. Increment `DB_VERSION` constant
2. Update `onupgradeneeded` handler
3. Users will need to clear browser data or code a migration

### 2. Authentication Flow

**File**: `/contexts/AuthContext.tsx`

```typescript
// Login flow:
1. User enters email/password
2. authAPI.login() searches IndexedDB users by email
3. Plain text password comparison (CHANGE IN PRODUCTION!)
4. User object stored in localStorage
5. Auth context updated, triggering re-render
6. Layout shows, login hides
```

**Security Note**: Currently uses plain text passwords. In production:
```typescript
// Use Supabase Auth or bcrypt
import bcrypt from 'bcrypt';
const isValid = await bcrypt.compare(password, user.password_hash);
```

### 3. Payroll Calculation Engine

**File**: `/lib/api.ts` → `payrollAPI.generatePayrollLines()`

**Logic**:
```typescript
1. Get all active staff
2. For each staff:
   a. Get basic salary from structure (GL + Step)
   b. Calculate allowances:
      - Fixed: direct amount
      - Percentage: basic * percentage / 100
   c. Calculate gross = basic + allowances
   d. Calculate deductions:
      - Percentage based on gross pay
   e. Calculate net = gross - deductions
   f. Create payroll line record
3. Update batch totals
```

**Example**:
```typescript
Basic: ₦50,000
Housing (50%): ₦25,000
Transport (25%): ₦12,500
Meal (fixed): ₦10,000
GROSS: ₦97,500

Pension (8%): ₦7,800
Tax (7%): ₦6,825
Cooperative: ₦5,000
DEDUCTIONS: ₦19,625

NET PAY: ₦77,875
```

### 4. Arrears Auto-Detection

**File**: `/lib/api.ts` → `promotionAPI.calculatePromotionArrears()`

**Triggers**:
- When promotion is approved
- When effective date is in the past

**Calculation**:
```typescript
1. Get old GL/Step salary from structure
2. Get new GL/Step salary from structure
3. Calculate months between effective_date and today
4. Monthly difference = new_salary - old_salary
5. Total arrears = monthly_difference * months_owed
6. Create detailed breakdown per month
7. Create arrears record (status: pending)
```

**Example**:
```typescript
Promotion: GL 7/S5 → GL 9/S1
Effective: March 1, 2024
Approved: June 15, 2024
Months owed: 3 (March, April, May)

Old salary: ₦35,500
New salary: ₦55,000
Difference: ₦19,500/month
Total arrears: ₦58,500
```

### 5. Multi-Level Approval Workflow

**File**: `/lib/api.ts` → `payrollAPI.submitForApproval()`

**System**:
```typescript
1. Payroll batch created (status: draft)
2. Submit for approval:
   - Status → pending_review
   - Create workflow_approvals records for each stage
   - current_approval_stage = 1
3. Stage 1 approval:
   - Mark stage 1 approved
   - current_approval_stage = 2
   - Status → in_review
4. Stages 2-3: Same pattern
5. All stages approved:
   - Status → approved
   - Ready to lock
6. Any stage rejected:
   - Status → rejected
   - Workflow stops
```

**Access Control**:
```typescript
// User can only approve if:
1. Current stage matches their role
2. Stage status is 'pending'
3. Previous stages are approved
```

### 6. Audit Trail System

**File**: `/lib/api.ts` → `logAudit()`

**Captures**:
- User ID and email
- Action type (CREATE, UPDATE, DELETE, etc.)
- Entity type (staff, payroll_batch, etc.)
- Entity ID
- Old values (for updates)
- New values
- Timestamp

**Usage**:
```typescript
await logAudit(
  user.id,
  user.email,
  'CREATE',
  'staff',
  staff.id,
  undefined,
  staffData
);
```

## Data Flow Diagrams

### Staff Creation Flow
```
User Input (Form)
    ↓
StaffListPage.handleCreateStaff()
    ↓
staffAPI.createStaff()
    ↓
db.create('staff', staffData)
    ↓
logAudit('CREATE', 'staff', ...)
    ↓
IndexedDB Write
    ↓
UI Update (reload staff list)
    ↓
Toast Notification
```

### Payroll Processing Flow
```
Create Batch
    ↓
Generate Lines (calculate salaries)
    ↓
Review Lines (optional adjustments)
    ↓
Submit for Approval
    ↓
Stage 1: Reviewer approves
    ↓
Stage 2: Approver approves
    ↓
Stage 3: Approver approves
    ↓
Stage 4: Auditor reviews
    ↓
Lock Payroll
    ↓
Export (CSV/Remita)
```

### Arrears Flow
```
Promotion Created (backdated)
    ↓
Promotion Approved
    ↓
Auto-calculate arrears
    ↓
Arrears record created (pending)
    ↓
Admin approves arrears
    ↓
Merge to payroll batch
    ↓
Arrears added to staff's net pay
    ↓
Arrears status → paid
```

## Component Patterns

### Reusable Components

#### DataTable
```typescript
<DataTable
  data={items}
  columns={[
    { header: 'Name', accessor: 'name', sortable: true },
    { header: 'Status', accessor: (row) => <Badge status={row.status} /> }
  ]}
  onRowClick={handleRowClick}
  searchable
  searchPlaceholder="Search..."
/>
```

#### Modal
```typescript
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  size="lg"
  footer={<button>Save</button>}
>
  {children}
</Modal>
```

#### Stepper
```typescript
<Stepper
  steps={[
    { label: 'Step 1', description: 'First step' },
    { label: 'Step 2', description: 'Second step' }
  ]}
  currentStep={currentStep}
/>
```

### State Management Pattern

Each page follows this pattern:
```typescript
function PageComponent() {
  // Local state
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Context
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      const result = await someAPI.getData();
      setData(result);
    } catch (error) {
      showToast('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  
  return (/* JSX */);
}
```

## Migration to Supabase

### Step-by-Step Migration Guide

#### 1. Database Setup
```sql
-- Create all tables matching IndexedDB stores
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_number TEXT UNIQUE NOT NULL,
  bio_data JSONB NOT NULL,
  next_of_kin JSONB NOT NULL,
  appointment JSONB NOT NULL,
  salary_info JSONB NOT NULL,
  documents JSONB[] DEFAULT '{}',
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Create indexes
CREATE INDEX idx_staff_number ON staff(staff_number);
CREATE INDEX idx_staff_status ON staff(status);

-- Enable RLS
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins and payroll officers can view staff"
  ON staff FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'payroll_officer', 'approver', 'reviewer', 'auditor')
  );

CREATE POLICY "Admins and payroll officers can insert staff"
  ON staff FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'payroll_officer')
  );

-- Repeat for all tables...
```

#### 2. Update API Layer
```typescript
// Before (IndexedDB)
import { db } from './indexeddb';
const staff = await db.getAll<Staff>('staff');

// After (Supabase)
import { supabase } from './supabase';
const { data: staff, error } = await supabase
  .from('staff')
  .select('*');
```

#### 3. Update Auth
```typescript
// Before
const { user, login, logout } = useAuth();
await login(email, password);

// After
const { user, session } = useSession();
const { error } = await supabase.auth.signInWithPassword({
  email,
  password
});
```

#### 4. Real-time Updates
```typescript
// Add real-time subscriptions
const channel = supabase
  .channel('payroll-changes')
  .on(
    'postgres_changes',
    { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'workflow_approvals' 
    },
    (payload) => {
      // Update UI when approval changes
      loadApprovals();
    }
  )
  .subscribe();
```

#### 5. File Storage (for documents)
```typescript
// Upload staff documents
const { data, error } = await supabase.storage
  .from('staff-documents')
  .upload(`${staffId}/${fileName}`, file);
```

## Testing Strategy

### Manual Testing Checklist

#### Authentication
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Logout
- [ ] Session persistence (refresh page)

#### Staff Management
- [ ] Create new staff (all 4 steps)
- [ ] View staff list
- [ ] View staff details
- [ ] Update staff
- [ ] Deactivate staff

#### Payroll Processing
- [ ] Create payroll batch
- [ ] Generate payroll lines
- [ ] Review calculations (spot check)
- [ ] Submit for approval
- [ ] Approve at each stage
- [ ] Reject and verify status
- [ ] Lock payroll

#### Arrears
- [ ] Create backdated promotion
- [ ] Verify arrears auto-created
- [ ] Approve arrears
- [ ] Merge to payroll batch
- [ ] Verify added to net pay

#### Approvals
- [ ] View pending approvals
- [ ] Approve as different roles
- [ ] Reject with comments
- [ ] Verify workflow progression

### Data Validation

Test edge cases:
- Empty form submissions
- Invalid date ranges
- Duplicate staff numbers
- Negative amounts
- Missing required fields

## Performance Considerations

### Current Performance
- IndexedDB operations are async but fast (< 10ms typically)
- No network latency
- Pagination on all tables (10 items per page)
- Debounced search (simulated in DataTable)

### Optimization for Production
1. **Implement query caching**
   ```typescript
   // Use React Query or SWR
   const { data, error } = useSWR('staff', () => staffAPI.getAllStaff());
   ```

2. **Virtual scrolling for large lists**
   ```typescript
   // Use react-virtual for 1000+ items
   import { useVirtual } from 'react-virtual';
   ```

3. **Lazy load components**
   ```typescript
   const StaffListPage = lazy(() => import('./pages/StaffListPage'));
   ```

4. **Index all foreign keys in Supabase**

5. **Use Supabase filters instead of client-side filtering**
   ```typescript
   // Better
   .select('*').eq('status', 'active')
   
   // Avoid
   const all = await select('*');
   const active = all.filter(s => s.status === 'active');
   ```

## Known Limitations

1. **No real authentication** - Plain text passwords
2. **No data encryption** - All data in clear text
3. **No backup/restore** - Data only in browser
4. **No concurrent user handling** - Single user only
5. **No email notifications** - Manual process
6. **No PDF generation** - Payslips not implemented
7. **No bulk operations** - One-by-one only
8. **No data export** - CSV export stubbed
9. **Limited validation** - Basic HTML5 validation only
10. **No mobile app** - Web only

## Future Roadmap

### Phase 1: Production Migration (Priority)
- [ ] Migrate to Supabase
- [ ] Implement proper authentication
- [ ] Add Row Level Security
- [ ] Set up backups

### Phase 2: Core Features
- [ ] PDF payslip generation
- [ ] Email notifications
- [ ] Bulk staff upload
- [ ] Advanced validation

### Phase 3: Enhancements
- [ ] Analytics dashboard
- [ ] Report builder
- [ ] Document management
- [ ] Bank API integration

### Phase 4: Advanced
- [ ] Mobile app (React Native)
- [ ] Biometric auth
- [ ] AI-powered insights
- [ ] Tax automation

## Deployment Instructions

### Local Development
```bash
# Already running in Figma Make
# Just edit and save files
```

### Production Deployment

#### Option 1: Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

#### Option 2: Netlify
```bash
# Build
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

#### Option 3: Self-hosted
```bash
# Build
npm run build

# Serve with nginx
server {
  listen 80;
  server_name jsc-payroll.gov.ng;
  root /var/www/jsc-payroll/dist;
  
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## Support & Maintenance

### Common Issues

**Issue**: "IndexedDB not available"
**Solution**: Ensure browser supports IndexedDB, not in private mode

**Issue**: "Data disappeared"
**Solution**: IndexedDB was cleared, need to re-seed

**Issue**: "Can't approve payroll"
**Solution**: Check user role matches current stage

**Issue**: "Calculations wrong"
**Solution**: Verify salary structure is correct

### Debugging Tips

```typescript
// Enable IndexedDB debugging
localStorage.setItem('debug', 'indexeddb');

// Check current user
console.log(JSON.parse(localStorage.getItem('jsc_user')));

// Check database contents
const staff = await db.getAll('staff');
console.table(staff);

// Check audit trail
const audits = await db.getAll('audit_trail');
console.table(audits.slice(-20)); // Last 20 actions
```

## Contact & Handoff

**Built by**: Figma Make AI
**Date**: 2024
**Version**: 1.0.0 (Prototype)
**Status**: Ready for migration to production

**Next Steps**:
1. Review this documentation
2. Test all features with default accounts
3. Set up Supabase project
4. Begin database migration
5. Update API layer
6. Implement authentication
7. Add Row Level Security
8. Deploy to staging
9. User acceptance testing
10. Production deployment

---

**Good luck with the production deployment! 🚀**
