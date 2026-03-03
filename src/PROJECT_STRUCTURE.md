# 📁 JSC-PMS Project Structure

Complete file structure for the production Nigerian Judicial Service Committee Payroll Management System.

---

## 🗂️ Root Directory

```
jsc-pms/
├── backend/                    # NestJS backend API
├── database/                   # PostgreSQL schema & seeds
├── PHASE_1_COMPLETE.md        # ✅ Completion summary
├── PRODUCTION_SETUP_GUIDE.md  # 📚 Deployment guide
├── QUICK_REFERENCE.md         # 🚀 Command reference
└── PROJECT_STRUCTURE.md       # 📁 This file
```

---

## 🗄️ Database Directory

```
database/
├── schema.sql          # Complete PostgreSQL schema (30 tables)
└── seeds.sql           # Seed data (users, departments, cooperatives, etc.)
```

### Tables Created (30)

**Core Tables (3)**
- `users` - System users & authentication
- `departments` - Organizational departments
- `staff` - Staff records & bio data

**Salary & Payroll (10)**
- `salary_structures` - Grade levels & steps
- `allowances` - Global allowance configurations
- `deductions` - Global deduction configurations
- `staff_allowances` - Staff-specific allowances
- `staff_deductions` - Staff-specific deductions
- `payroll_batches` - Monthly payroll batches
- `payroll_lines` - Individual staff payroll records
- `workflow_approvals` - Multi-level approval tracking
- `arrears` - Arrears management
- `promotions` - Staff promotion records

**Leave Management (3)**
- `leave_types` - Leave type configurations
- `leave_balances` - Staff leave balances by year
- `leave_requests` - Leave applications

**Cooperative & Loans (8)**
- `cooperatives` - Cooperative societies
- `cooperative_members` - Membership records
- `cooperative_contributions` - Contribution tracking
- `loan_types` - Loan type configurations
- `loan_applications` - Loan applications
- `loan_guarantors` - Loan guarantor records
- `loan_disbursements` - Disbursed loans
- `loan_repayments` - Loan repayment tracking

**System Tables (6)**
- `notifications` - In-app notifications
- `audit_trail` - System audit log
- `system_settings` - System-wide configurations
- `bank_schedules` - Bank payment schedules
- `payroll_calendar_events` - Payroll calendar
- `staff_documents` - Document attachments

---

## 🔙 Backend Directory Structure

```
backend/
├── src/
│   ├── common/                      # Shared utilities & services
│   │   ├── database/                # Database layer
│   │   │   ├── database.module.ts   # Database module
│   │   │   └── database.service.ts  # ✅ Supabase + PostgreSQL service
│   │   ├── decorators/              # Custom decorators
│   │   │   ├── public.decorator.ts  # ✅ @Public() for unprotected routes
│   │   │   └── roles.decorator.ts   # ✅ @Roles() for RBAC
│   │   └── guards/                  # Auth guards
│   │       ├── jwt-auth.guard.ts    # ✅ Global JWT authentication
│   │       └── roles.guard.ts       # ✅ Role-based access control
│   │
│   ├── modules/                     # Feature modules
│   │   ├── auth/                    # ✅ COMPLETE - Authentication
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── login.dto.ts
│   │   │   │   └── change-password.dto.ts
│   │   │   ├── interfaces/
│   │   │   │   └── jwt-payload.interface.ts
│   │   │   └── strategies/
│   │   │       ├── jwt.strategy.ts
│   │   │       └── local.strategy.ts
│   │   │
│   │   ├── staff/                   # ✅ COMPLETE - Staff Management (REFERENCE)
│   │   │   ├── staff.module.ts
│   │   │   ├── staff.controller.ts  # 9 endpoints
│   │   │   ├── staff.service.ts     # Full CRUD + statistics + bulk import
│   │   │   └── dto/
│   │   │       ├── create-staff.dto.ts
│   │   │       ├── update-staff.dto.ts
│   │   │       └── query-staff.dto.ts
│   │   │
│   │   ├── departments/             # ✅ COMPLETE - Basic department management
│   │   │   ├── departments.module.ts
│   │   │   ├── departments.controller.ts
│   │   │   └── departments.service.ts
│   │   │
│   │   ├── payroll/                 # 🚧 TO IMPLEMENT
│   │   │   └── payroll.module.ts    # Stub
│   │   │
│   │   ├── allowances/              # 🚧 TO IMPLEMENT
│   │   │   └── allowances.module.ts # Stub
│   │   │
│   │   ├── deductions/              # 🚧 TO IMPLEMENT
│   │   │   └── deductions.module.ts # Stub
│   │   │
│   │   └── audit/                   # 🚧 TO IMPLEMENT
│   │       └── audit.module.ts      # Stub
│   │
│   ├── app.module.ts                # ✅ Main application module
│   └── main.ts                      # ✅ Application entry point
│
├── scripts/
│   └── hash-password.js             # ✅ Password hashing utility
│
├── .env.example                     # ✅ Environment variables template
├── .dockerignore                    # ✅ Docker ignore file
├── .gitignore                       # ✅ Git ignore file
├── Dockerfile                       # ✅ Production Docker image
├── nest-cli.json                    # ✅ NestJS CLI config
├── package.json                     # ✅ Dependencies
├── tsconfig.json                    # ✅ TypeScript config
└── README.md                        # ✅ Backend documentation
```

---

## 📊 Module Status Overview

### ✅ Completed Modules (Phase 1)

#### 1. Authentication Module
**Location**: `/backend/src/modules/auth/`

**Features**:
- JWT-based authentication
- Login with email/password
- Get user profile
- Change password
- Token refresh ready

**Endpoints**:
- `POST /auth/login`
- `GET /auth/profile`
- `PATCH /auth/change-password`

#### 2. Staff Management Module ⭐ REFERENCE IMPLEMENTATION
**Location**: `/backend/src/modules/staff/`

**Features**:
- Create staff with auto-generated staff number
- List staff with pagination, search, filtering
- Get staff by ID or staff number
- Update staff information
- Soft delete (termination)
- Get staff statistics
- Get payroll-eligible staff
- Bulk import

**Endpoints**:
- `POST /staff`
- `GET /staff`
- `GET /staff/statistics`
- `GET /staff/payroll-eligible`
- `GET /staff/:id`
- `GET /staff/by-number/:staffNumber`
- `PATCH /staff/:id`
- `DELETE /staff/:id`
- `POST /staff/bulk-import`

**Code Quality**:
- ✅ Full TypeScript types
- ✅ DTO validation
- ✅ Swagger documentation
- ✅ RBAC permissions
- ✅ Error handling
- ✅ Audit logging

#### 3. Departments Module
**Location**: `/backend/src/modules/departments/`

**Features**:
- List all departments
- Get department by ID

**Endpoints**:
- `GET /departments`
- `GET /departments/:id`

### 🚧 To Be Implemented (Phase 2+)

Following modules need to be built using **Staff Module** as reference:

#### 4. Payroll Module
- Create payroll batch
- Generate payroll lines (bulk insert for 800+ staff)
- Submit for approval
- Multi-level approval workflow
- Lock payroll
- Execute payment
- Get payroll history
- Download payslips

#### 5. Allowances Module
- CRUD global allowances
- CRUD staff-specific allowances
- Activation/deactivation
- Historical tracking

#### 6. Deductions Module
- CRUD global deductions
- CRUD staff-specific deductions
- Activation/deactivation
- Historical tracking

#### 7. Leave Management Module
- CRUD leave types
- Leave balance management
- Leave requests
- Leave approval workflow
- Automatic unpaid leave deductions

#### 8. Loan & Cooperative Module
- CRUD cooperatives
- Member management
- Contribution tracking
- CRUD loan types
- Loan applications
- Guarantor management
- Loan disbursement
- Repayment tracking

#### 9. Reports Module
- Payroll reports
- Staff reports
- Financial summaries
- Custom reports
- Export (PDF, Excel)

#### 10. Audit Module
- View audit trail
- Filter by user/action/date
- Export audit logs

---

## 🔑 Key Files Explained

### `/database/schema.sql`
**Purpose**: Complete PostgreSQL database schema
**Size**: ~1000 lines
**Contains**:
- 30 table definitions
- All indexes and foreign keys
- Triggers for auto-updating timestamps
- Bulk insert function for payroll
- UUID extension setup

### `/database/seeds.sql`
**Purpose**: Initial data for system setup
**Contains**:
- 6 demo users (all roles)
- 5 departments
- Complete salary structure
- 5 global allowances
- 3 global deductions
- 7 leave types
- 3 cooperatives
- 4 loan types
- System settings with PAYE tax config

### `/backend/src/common/database/database.service.ts`
**Purpose**: Core database service
**Features**:
- Supabase client for auth & storage
- PostgreSQL pool for queries
- Query helpers (query, queryOne, transaction)
- Bulk insert helper
- Health check

### `/backend/src/modules/staff/staff.service.ts`
**Purpose**: Staff management business logic (REFERENCE)
**Size**: ~350 lines
**Features**:
- Auto-generate staff numbers
- Pagination & filtering
- Statistics aggregation
- Bulk operations
- Transaction support

### `/backend/src/main.ts`
**Purpose**: Application entry point
**Features**:
- NestJS bootstrap
- Global validation pipe
- CORS configuration
- Swagger setup
- API prefix configuration

---

## 📦 Dependencies

### Production Dependencies
```json
{
  "@nestjs/common": "^10.3.0",
  "@nestjs/core": "^10.3.0",
  "@nestjs/platform-express": "^10.3.0",
  "@nestjs/config": "^3.1.1",
  "@nestjs/jwt": "^10.2.0",
  "@nestjs/passport": "^10.0.3",
  "@nestjs/swagger": "^7.1.17",
  "@supabase/supabase-js": "^2.39.3",
  "bcrypt": "^5.1.1",
  "class-transformer": "^0.5.1",
  "class-validator": "^0.14.1",
  "passport-jwt": "^4.0.1",
  "pg": "^8.11.3",
  "uuid": "^9.0.1"
}
```

### Development Dependencies
```json
{
  "@nestjs/cli": "^10.2.1",
  "@nestjs/testing": "^10.3.0",
  "@types/bcrypt": "^5.0.2",
  "@types/jest": "^29.5.11",
  "@types/passport-jwt": "^4.0.0",
  "typescript": "^5.3.3"
}
```

---

## 🎯 File Count Summary

```
Total Files: ~40

Database Files: 2
├── schema.sql (30 tables, ~1000 lines)
└── seeds.sql (demo data, ~250 lines)

Backend Core: 8
├── main.ts
├── app.module.ts
├── database.service.ts
├── jwt-auth.guard.ts
├── roles.guard.ts
├── public.decorator.ts
├── roles.decorator.ts
└── hash-password.js

Auth Module: 7
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── login.dto.ts
├── change-password.dto.ts
├── jwt-payload.interface.ts
└── jwt.strategy.ts (+ local.strategy.ts)

Staff Module: 4
├── staff.module.ts
├── staff.controller.ts
├── staff.service.ts
└── DTOs (create, update, query)

Other Modules: 3
├── departments.module.ts
├── departments.controller.ts
└── departments.service.ts

Config Files: 7
├── package.json
├── tsconfig.json
├── nest-cli.json
├── .env.example
├── Dockerfile
├── .dockerignore
└── .gitignore

Documentation: 4
├── PHASE_1_COMPLETE.md
├── PRODUCTION_SETUP_GUIDE.md
├── QUICK_REFERENCE.md
└── PROJECT_STRUCTURE.md
```

---

## 🚀 Build Output

When you run `npm run build`, NestJS creates:

```
dist/
├── common/
│   ├── database/
│   ├── decorators/
│   └── guards/
├── modules/
│   ├── auth/
│   ├── staff/
│   └── departments/
├── app.module.js
├── main.js
└── (all .d.ts type definition files)
```

---

## 🎓 How to Navigate This Project

### For New Developers:
1. Start with **PHASE_1_COMPLETE.md** - Understand what's built
2. Read **PRODUCTION_SETUP_GUIDE.md** - Learn deployment
3. Study **Staff Module** - Your reference for all modules
4. Use **QUICK_REFERENCE.md** - Common commands
5. Check **Swagger UI** - Interactive API testing

### For Database Work:
1. Review `/database/schema.sql` - Full schema
2. Check `/database/seeds.sql` - Sample data
3. Use Supabase SQL Editor - Query interface

### For Backend Development:
1. Study `/backend/src/modules/staff/` - Complete example
2. Check `/backend/src/common/` - Shared utilities
3. Review DTOs for validation patterns
4. Follow guard patterns for RBAC

### For API Integration:
1. Access Swagger UI at `/api/docs`
2. Test with Postman or cURL
3. Reference **QUICK_REFERENCE.md** for examples

---

## 📝 Next Files to Create

When implementing remaining modules, create files following this pattern:

```
modules/feature/
├── feature.module.ts
├── feature.controller.ts
├── feature.service.ts
├── dto/
│   ├── create-feature.dto.ts
│   ├── update-feature.dto.ts
│   └── query-feature.dto.ts
└── interfaces/ (if needed)
    └── feature.interface.ts
```

---

**This project structure is designed for scalability, maintainability, and production deployment.**
