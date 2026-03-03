# JSC-PMS Production Setup Guide

Complete guide to deploying the Nigerian Judicial Service Committee Payroll Management System to production.

---

## 📋 Table of Contents

1. [Phase 1 Foundation - COMPLETED](#phase-1-foundation)
2. [Supabase Setup](#supabase-setup)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Migration](#frontend-migration)
5. [Testing & Validation](#testing--validation)
6. [Production Checklist](#production-checklist)

---

## 🎯 Phase 1 Foundation - COMPLETED ✅

### What Has Been Built

#### 1. Complete PostgreSQL Schema (`/database/schema.sql`)
- ✅ 30 production-ready tables
- ✅ All indexes and foreign key constraints
- ✅ Triggers for auto-updating timestamps
- ✅ Bulk insert function for payroll lines
- ✅ UUID primary keys
- ✅ JSONB columns for flexible data

**Tables Created:**
- Core: users, departments, staff
- Payroll: payroll_batches, payroll_lines, workflow_approvals, arrears, promotions
- Salary: salary_structures, allowances, deductions, staff_allowances, staff_deductions
- Leave: leave_types, leave_balances, leave_requests
- Cooperative/Loan: cooperatives, cooperative_members, cooperative_contributions, loan_types, loan_applications, loan_guarantors, loan_disbursements, loan_repayments
- System: notifications, audit_trail, system_settings, bank_schedules, payroll_calendar_events, staff_documents

#### 2. Seed Data (`/database/seeds.sql`)
- ✅ Default system settings
- ✅ 5 departments
- ✅ Complete salary structure (6 grade levels)
- ✅ 5 global allowances
- ✅ 3 global deductions
- ✅ 7 leave types
- ✅ 6 demo users (all roles)
- ✅ 3 cooperatives
- ✅ 4 loan types

#### 3. NestJS Backend Structure (`/backend/`)
- ✅ Main application (`src/main.ts`, `src/app.module.ts`)
- ✅ Database service with Supabase + PostgreSQL pool
- ✅ JWT Authentication module
- ✅ Role-based access control (RBAC)
- ✅ **Complete Staff Management Module** (Reference Implementation)
- ✅ Departments module
- ✅ Swagger API documentation
- ✅ Docker support

#### 4. Staff Management Module (Reference Implementation)
This is the **complete, production-ready reference** for all other modules:

**Features:**
- ✅ Create staff with auto-generated staff number
- ✅ Get all staff with pagination, search, and filtering
- ✅ Get staff by ID or staff number
- ✅ Update staff information
- ✅ Soft delete (termination)
- ✅ Get payroll-eligible staff
- ✅ Staff statistics (overview, by department, by grade)
- ✅ Bulk import functionality
- ✅ Full DTO validation
- ✅ Role-based permissions

**API Endpoints:**
```
POST   /api/v1/staff                    - Create staff
GET    /api/v1/staff                    - Get all (paginated)
GET    /api/v1/staff/statistics         - Get statistics
GET    /api/v1/staff/payroll-eligible   - Get active staff for payroll
GET    /api/v1/staff/:id                - Get by ID
GET    /api/v1/staff/by-number/:number  - Get by staff number
PATCH  /api/v1/staff/:id                - Update staff
DELETE /api/v1/staff/:id                - Soft delete
POST   /api/v1/staff/bulk-import        - Bulk import
```

---

## 🗄️ Supabase Setup

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in or create account
3. Click **"New Project"**
4. Fill in:
   - **Name**: JSC Payroll Management System
   - **Database Password**: (Save this securely!)
   - **Region**: Choose closest to Nigeria (e.g., Frankfurt, London)
   - **Pricing Plan**: Pro (recommended for 800+ staff)

### Step 2: Get Connection Details

Once project is created, go to **Project Settings** → **Database**:

```env
# Copy these values to your .env file

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database Connection String (under "Connection string" → "URI")
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

### Step 3: Run Database Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy entire contents of `/database/schema.sql`
4. Paste and click **"Run"**
5. Wait for completion (should see "Success")

### Step 4: Run Seed Data

1. Create another new query
2. Copy entire contents of `/database/seeds.sql`
3. Paste and click **"Run"**
4. Verify data was inserted: Go to **Table Editor** and check tables

### Step 5: (Optional) Enable Row Level Security

**Note**: RLS is optional since backend uses SERVICE_ROLE_KEY which bypasses RLS.
However, enabling RLS provides **defense in depth** for audit compliance.

**To Enable RLS:**
1. Create another new query
2. Copy entire contents of `/database/rls-policies.sql`
3. Paste and click **"Run"**

**Why Enable RLS?**
- ✅ Extra security layer (defense in depth)
- ✅ Audit compliance for government systems
- ✅ Protects against direct database access
- ✅ Future-proofing

**Why Skip RLS?**
- Backend already handles all authorization
- SERVICE_ROLE_KEY bypasses RLS anyway
- Simpler configuration

See **[SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md)** for details.

### Step 6: Verify Installation

Run these queries in SQL Editor to verify:

```sql
-- Check tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check users were seeded
SELECT email, role FROM users;

-- Check departments
SELECT name, code FROM departments;

-- Check salary structure
SELECT name, code FROM salary_structures;
```

You should see:
- 30 tables
- 6 users
- 5 departments
- 1 salary structure

---

## 🚀 Backend Deployment

### Option A: Local Development

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your Supabase credentials
nano .env  # or use any text editor

# Run in development mode
npm run start:dev

# API will be available at http://localhost:3000
# Swagger docs at http://localhost:3000/api/docs
```

### Option B: Docker Deployment

```bash
cd backend

# Build Docker image
docker build -t jsc-pms-backend .

# Run container
docker run -p 3000:3000 \
  -e SUPABASE_URL=https://xxxxx.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=your-key \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=your-secret \
  jsc-pms-backend
```

### Option C: Production Deployment (Railway, Render, etc.)

#### Using Railway:

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login and deploy:
```bash
cd backend
railway login
railway init
railway up
```

3. Add environment variables in Railway dashboard

#### Using Render:

1. Connect your GitHub repository
2. Create new **Web Service**
3. Set build command: `npm install && npm run build`
4. Set start command: `npm run start:prod`
5. Add environment variables

---

## 🔄 Frontend Migration

### Current State
- ✅ React frontend uses IndexedDB
- ✅ All UI components complete
- ✅ Full functionality in prototype

### Migration Strategy

#### Step 1: Create API Client Service

Create `/frontend/src/lib/apiClient.ts`:

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to all requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

#### Step 2: Replace IndexedDB Calls

Example for Staff Management:

**Before (IndexedDB):**
```typescript
import { db } from './indexeddb';

export const staffAPI = {
  async getAll() {
    return db.getAll('staff');
  },
  async create(staff) {
    return db.create('staff', staff);
  }
};
```

**After (HTTP API):**
```typescript
import apiClient from './apiClient';

export const staffAPI = {
  async getAll(params?) {
    const { data } = await apiClient.get('/staff', { params });
    return data;
  },
  async create(staff) {
    const { data } = await apiClient.post('/staff', staff);
    return data;
  }
};
```

#### Step 3: Update Auth Flow

**Before:**
```typescript
const users = await db.getByIndex('users', 'email', email);
```

**After:**
```typescript
const { data } = await apiClient.post('/auth/login', { email, password });
localStorage.setItem('accessToken', data.accessToken);
```

---

## ✅ Testing & Validation

### 1. Backend API Tests

```bash
cd backend

# Test login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@jsc.gov.ng", "password": "password123"}'

# Save the token from response
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Test staff creation
curl -X POST http://localhost:3000/api/v1/staff \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "dateOfBirth": "1990-01-01",
    "gender": "Male",
    "maritalStatus": "Single",
    "stateOfOrigin": "Lagos",
    "departmentId": "d1111111-1111-1111-1111-111111111111",
    "designation": "Officer",
    "employmentType": "Permanent",
    "employmentDate": "2024-01-01",
    "gradeLevel": 7,
    "step": 1,
    "currentBasicSalary": 250000
  }'
```

### 2. Load Testing (800+ Staff)

Create test script `test-bulk.js`:

```javascript
const axios = require('axios');

async function testBulkPayroll() {
  // Login
  const { data: auth } = await axios.post('http://localhost:3000/api/v1/auth/login', {
    email: 'admin@jsc.gov.ng',
    password: 'password123'
  });

  const token = auth.accessToken;

  // Get payroll eligible staff
  const { data: staff } = await axios.get(
    'http://localhost:3000/api/v1/staff/payroll-eligible',
    { headers: { Authorization: `Bearer ${token}` } }
  );

  console.log(`✅ Retrieved ${staff.length} staff members`);
  console.log(`⏱️  Time: ${Date.now() - start}ms`);
}

testBulkPayroll();
```

---

## 📝 Production Checklist

### Security
- [ ] Change all default passwords in `seeds.sql`
- [ ] Generate strong JWT secret (min 64 characters)
- [ ] Enable Supabase Row Level Security (RLS)
- [ ] Set up CORS for production domain only
- [ ] Enable HTTPS/SSL
- [ ] Set up rate limiting
- [ ] Configure Supabase security rules

### Database
- [ ] Run schema.sql in production Supabase
- [ ] Run seeds.sql (with updated passwords)
- [ ] Set up database backups
- [ ] Configure database connection pooling
- [ ] Test bulk operations with 800+ records

### Backend
- [ ] Set environment to `NODE_ENV=production`
- [ ] Configure production Supabase credentials
- [ ] Set up monitoring (e.g., Sentry)
- [ ] Configure logging
- [ ] Set up health check endpoint
- [ ] Test all API endpoints

### Frontend
- [ ] Update API base URL to production
- [ ] Replace all IndexedDB calls with HTTP API calls
- [ ] Test authentication flow
- [ ] Test all CRUD operations
- [ ] Test bulk payroll processing
- [ ] Build production bundle
- [ ] Deploy to hosting (Vercel, Netlify, etc.)

### Testing
- [ ] Test with real 800+ staff data
- [ ] Load test payroll batch processing
- [ ] Test all user roles and permissions
- [ ] Test approval workflows
- [ ] Test bank integration
- [ ] Test reporting features

### Documentation
- [ ] Update API documentation
- [ ] Create user manual
- [ ] Create admin guide
- [ ] Document deployment process
- [ ] Create troubleshooting guide

---

## 🎯 Next Phase: Building Remaining Modules

All remaining modules should follow the **Staff Module** pattern:

### Payroll Module Structure (Example)
```
modules/payroll/
├── payroll.module.ts
├── payroll.controller.ts
├── payroll.service.ts
├── dto/
│   ├── create-batch.dto.ts
│   ├── generate-lines.dto.ts
│   └── approve-batch.dto.ts
└── interfaces/
    └── payroll-batch.interface.ts
```

### Key Patterns to Follow
1. **Service Layer**: All business logic
2. **Controller**: API endpoints with Swagger docs
3. **DTOs**: Input validation with class-validator
4. **Guards**: Role-based access control
5. **Database**: Use DatabaseService for queries
6. **Transactions**: Wrap critical operations
7. **Bulk Operations**: Use `bulkInsert` for large datasets
8. **Logging**: Use Logger for audit trail

---

## 📞 Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **NestJS Docs**: https://docs.nestjs.com
- **PostgreSQL Docs**: https://www.postgresql.org/docs
- **Swagger UI**: http://localhost:3000/api/docs (when running)

---

## 🎉 You're Ready for Production!

Phase 1 Foundation is complete. You now have:
- ✅ Production-ready database schema
- ✅ Authentication & authorization system
- ✅ Complete Staff Management module (reference implementation)
- ✅ API documentation
- ✅ Docker deployment support

**Next Steps:**
1. Set up Supabase project
2. Deploy backend
3. Test with Swagger UI
4. Start building remaining modules using Staff Module as reference
5. Migrate frontend API calls

Good luck! 🚀