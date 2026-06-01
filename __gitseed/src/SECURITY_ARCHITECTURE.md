# 🔒 JSC-PMS Security Architecture

## Overview

JSC-PMS uses a **hybrid security approach** with **application-level security as primary** and **database-level security as backup** (defense in depth).

---

## 🏗️ Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│                  (React + TypeScript)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP + JWT Token
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    NestJS BACKEND                            │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         JWT Authentication Guard                    │    │
│  │  - Validates JWT token                             │    │
│  │  - Extracts user ID, role, department              │    │
│  └────────────────────┬───────────────────────────────┘    │
│                       │                                      │
│  ┌────────────────────▼───────────────────────────────┐    │
│  │         Role-Based Access Guard                     │    │
│  │  - @Roles('Admin', 'Payroll Officer')              │    │
│  │  - Checks if user role matches required roles      │    │
│  └────────────────────┬───────────────────────────────┘    │
│                       │                                      │
│  ┌────────────────────▼───────────────────────────────┐    │
│  │         Business Logic (Services)                   │    │
│  │  - Validates business rules                        │    │
│  │  - Processes requests                              │    │
│  └────────────────────┬───────────────────────────────┘    │
│                       │                                      │
└───────────────────────┼──────────────────────────────────────┘
                        │ SERVICE_ROLE_KEY (bypasses RLS)
                        │
┌───────────────────────▼──────────────────────────────────────┐
│              SUPABASE POSTGRESQL DATABASE                    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Row Level Security (RLS)                    │    │
│  │  - OPTIONAL: Defense in depth                      │    │
│  │  - Backend bypasses with SERVICE_ROLE_KEY          │    │
│  │  - Protects against direct database access         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Database Tables (30 tables)                 │    │
│  │  - staff, payroll_batches, users, etc.            │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Layers

### **Layer 1: Application Security (PRIMARY)** ✅

**Location**: NestJS Backend  
**Status**: ACTIVE  
**Purpose**: Main authorization and authentication

#### JWT Authentication
```typescript
// Every request validated
@UseGuards(JwtAuthGuard)
export class StaffController {
  // User must be authenticated
}
```

**Features:**
- Custom JWT tokens (not Supabase Auth)
- Token includes: `userId`, `email`, `role`, `departmentId`
- Token expiration: 24 hours (configurable)
- Refresh token support ready

#### Role-Based Access Control (RBAC)
```typescript
@Post('batches/:id/lock')
@Roles('Admin')  // Only Admin can lock batches
@UseGuards(RolesGuard)
lockBatch(@Param('id') id: string) {
  // Authorization checked before method runs
}
```

**7 User Roles:**
1. **Admin** - Full system access
2. **Payroll Officer** - Create/manage payroll
3. **Payroll/HR Manager** - Approve payroll, manage staff
4. **Accountant** - Financial approval
5. **Auditor** - Read-only access
6. **Cashier** - View approved batches, execute payments
7. **Staff** - View own data only

#### Input Validation
```typescript
// All DTOs validated with class-validator
export class CreateStaffDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNumber()
  @Min(1)
  gradeLevel: number;
}
```

#### Audit Trail
```typescript
// All critical operations logged
this.logger.log(`Staff ${id} created by user ${userId}`);
// Stored in audit_trail table
```

---

### **Layer 2: Database Security (BACKUP)** 🛡️

**Location**: PostgreSQL (Supabase)  
**Status**: OPTIONAL (Recommended)  
**Purpose**: Defense in depth, audit compliance

#### Row Level Security (RLS)

**Current Configuration:**
```sql
-- Backend uses SERVICE_ROLE_KEY which BYPASSES RLS
-- RLS policies protect against:
-- 1. Accidental direct database access
-- 2. Backend security bugs
-- 3. Future direct client access
```

**RLS Policies Example:**
```sql
-- Only Admin can delete staff
CREATE POLICY "Only admins can delete staff"
  ON staff FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'Admin'
      AND u.status = 'active'
    )
  );
```

**Important Notes:**
- ✅ RLS enabled = extra security layer
- ✅ Backend bypasses with `SERVICE_ROLE_KEY`
- ✅ Protects if client tries direct access
- ✅ Good for audit compliance

---

## 🔑 Authentication Keys

### Anon Key (Not Used)
```env
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- ❌ **NOT USED** in JSC-PMS
- Used for client-side Supabase Auth
- Respects RLS policies
- We use custom JWT instead

### Service Role Key (Backend)
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- ✅ **USED** by NestJS backend
- Full database access
- **BYPASSES RLS policies**
- Never exposed to frontend
- Security enforced by application code

---

## 🎯 Security Decision Matrix

| Scenario | Protected By | How |
|----------|--------------|-----|
| **Unauthorized API request** | Application Layer | JWT guard rejects request |
| **Wrong role tries admin action** | Application Layer | @Roles guard blocks access |
| **Invalid input data** | Application Layer | DTO validation fails |
| **Direct database access attempt** | Database Layer (RLS) | RLS policies block access |
| **Backend security bug** | Database Layer (RLS) | RLS provides fallback protection |
| **SQL injection attempt** | Application Layer | Parameterized queries prevent |

---

## 🚨 Do You Need RLS?

### **NO, if:**
- ✅ Backend is your only database client
- ✅ Frontend NEVER connects directly to database
- ✅ You trust your backend security implementation
- ✅ You have other security measures (network security, VPC)

### **YES, if:**
- ✅ Government/audit compliance required
- ✅ Extra security layer desired (defense in depth)
- ✅ Future-proofing for direct client access
- ✅ Protecting against backend vulnerabilities
- ✅ Multiple systems accessing same database

---

## 📊 Current JSC-PMS Configuration

### **Primary Security: Application Layer** ✅

```typescript
// backend/src/common/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // All requests pass through here
}

// backend/src/common/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  // Role validation happens here
}
```

**Database Connection:**
```typescript
// backend/src/common/database/database.service.ts
createClient(supabaseUrl, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
// Uses SERVICE_ROLE_KEY = bypasses RLS
```

### **Backup Security: Database Layer** 🛡️ (Optional)

Run `/database/rls-policies.sql` to enable RLS policies.

**To Enable:**
```bash
# In Supabase SQL Editor
\i database/rls-policies.sql
```

**To Disable:**
```sql
-- If you want pure application-level security
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_batches DISABLE ROW LEVEL SECURITY;
-- ... (for all tables)
```

---

## 🎓 Comparison with Other Approaches

### **Approach 1: Supabase Auth + RLS (Not Used)**
```
Frontend → Supabase Auth → JWT → Direct to Database
                                     ↓
                              RLS Policies Enforce Security
```
**Pros:** Simple, built-in
**Cons:** No custom business logic, limited control

### **Approach 2: Backend API + No RLS (Partial)**
```
Frontend → Custom Backend → SERVICE_ROLE_KEY → Database
              ↓
         Auth & RBAC
```
**Pros:** Full control, custom logic
**Cons:** No database-level backup

### **Approach 3: Backend API + RLS (JSC-PMS)** ✅
```
Frontend → Custom Backend → SERVICE_ROLE_KEY → Database
              ↓                                   ↓
         Auth & RBAC                         RLS (Backup)
```
**Pros:** Defense in depth, full control, audit compliance
**Cons:** More complex setup (but already done!)

---

## 🔧 Security Configuration

### Current Setup

**Environment Variables:**
```env
# Backend uses SERVICE_ROLE_KEY
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Custom JWT secret (not Supabase Auth)
JWT_SECRET=your-custom-jwt-secret
JWT_EXPIRATION=24h
```

**Database Access:**
```typescript
// Backend bypasses RLS
const { data, error } = await supabase
  .from('staff')
  .select('*');
// Works regardless of RLS policies
```

**API Authorization:**
```typescript
// Frontend must include JWT token
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## ✅ Recommendation for JSC-PMS

### **Production Configuration: Enable Both Layers**

1. **Application Security** (Already Active) ✅
   - JWT authentication
   - Role-based access control
   - Input validation
   - Audit logging

2. **Database Security** (Recommended) 🛡️
   - Enable RLS policies
   - Run `/database/rls-policies.sql`
   - Provides defense in depth
   - Satisfies audit requirements

### **Why Both?**

**Application Layer:**
- Primary security
- Custom business logic
- Fine-grained control
- Fast and efficient

**Database Layer:**
- Backup protection
- Compliance requirement
- Prevents direct access
- Extra peace of mind

**Cost:** Negligible (backend bypasses RLS anyway)  
**Benefit:** Significant (extra security layer for free)

---

## 🚀 Implementation Steps

### Enable Full Security (Recommended)

```bash
# 1. Backend already has application security ✅
cd backend
npm run start:dev

# 2. Enable database RLS (optional but recommended)
# In Supabase SQL Editor:
# Copy and run /database/rls-policies.sql

# 3. Test both layers
curl -X GET http://localhost:3000/api/v1/staff
# Should return 401 Unauthorized (JWT guard working)

curl -X GET http://localhost:3000/api/v1/staff \
  -H "Authorization: Bearer $TOKEN"
# Should return data (authenticated)
```

---

## 📝 Summary

**JSC-PMS Security Architecture:**

✅ **Primary: Application Layer**
- Custom JWT authentication
- Role-based access control
- Input validation
- Audit trail

🛡️ **Backup: Database Layer (Optional)**
- Row Level Security policies
- Defense in depth
- Audit compliance
- Future-proofing

**Current Status:**
- Application security: ✅ **ACTIVE**
- Database security (RLS): 🛡️ **OPTIONAL** (recommended)

**Recommendation:**
Enable both layers for maximum security and compliance.

---

## 🔗 Related Documentation

- [Authentication Flow](./backend/src/modules/auth/)
- [RBAC Guards](./backend/src/common/guards/)
- [RLS Policies](./database/rls-policies.sql)
- [Security Best Practices](https://supabase.com/docs/guides/auth)

---

**Security is layered. More layers = more protection.** 🛡️
