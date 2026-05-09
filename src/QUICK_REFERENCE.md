# 🚀 JSC-PMS Quick Reference Card

## 📦 Installation & Setup

```bash
# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with Supabase credentials
npm run start:dev
```

## 🔑 Default Login Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@jsc.gov.ng | password123 | Admin |
| payroll@jsc.gov.ng | password123 | Payroll Officer |
| hr.manager@jsc.gov.ng | password123 | Payroll/HR Manager |
| accountant@jsc.gov.ng | password123 | Accountant |

## 🌐 API Endpoints

**Base URL**: `http://localhost:3000/api/v1`
**Swagger Docs**: `http://localhost:3000/api/docs`

### Authentication

```bash
# Login
POST /auth/login
{
  "email": "admin@jsc.gov.ng",
  "password": "password123"
}

# Get Profile
GET /auth/profile
Headers: Authorization: Bearer {token}

# Change Password
PATCH /auth/change-password
{
  "currentPassword": "password123",
  "newPassword": "newpassword456"
}
```

### Staff Management

```bash
# Create Staff
POST /staff
Headers: Authorization: Bearer {token}
{
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-15",
  "gender": "Male",
  "maritalStatus": "Married",
  "stateOfOrigin": "Lagos",
  "departmentId": "d1111111-1111-1111-1111-111111111111",
  "designation": "Legal Officer",
  "employmentType": "Permanent",
  "employmentDate": "2024-01-01",
  "gradeLevel": 8,
  "step": 1,
  "currentBasicSalary": 320000
}

# List Staff (with filters)
GET /staff?page=1&limit=20&search=john&status=active&departmentId=xxx

# Get Staff by ID
GET /staff/{id}

# Get Staff by Staff Number
GET /staff/by-number/JSC/2025/0001

# Update Staff
PATCH /staff/{id}
{
  "designation": "Senior Legal Officer",
  "gradeLevel": 9,
  "step": 1
}

# Delete Staff (soft delete)
DELETE /staff/{id}

# Get Statistics
GET /staff/statistics

# Get Payroll Eligible Staff
GET /staff/payroll-eligible

# Bulk Import
POST /staff/bulk-import
[
  { staff1 data },
  { staff2 data },
  ...
]
```

### Departments

```bash
# List All Departments
GET /departments

# Get Department by ID
GET /departments/{id}
```

## 🗄️ Database Quick Commands

### Using Supabase SQL Editor

```sql
-- Check all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Count staff
SELECT COUNT(*) FROM staff;

-- View users
SELECT email, role, status FROM users;

-- View departments
SELECT name, code FROM departments;

-- View payroll batches
SELECT batch_number, payroll_month, status, total_staff 
FROM payroll_batches 
ORDER BY created_at DESC;
```

## 🔧 Common Tasks

### Test Login via cURL

```bash
# Get token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@jsc.gov.ng","password":"password123"}' \
  | jq -r '.accessToken'

# Save token
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@jsc.gov.ng","password":"password123"}' \
  | jq -r '.accessToken')

# Use token
curl -X GET http://localhost:3000/api/v1/staff \
  -H "Authorization: Bearer $TOKEN"
```

### Create Staff via cURL

```bash
curl -X POST http://localhost:3000/api/v1/staff \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "dateOfBirth": "1992-05-20",
    "gender": "Female",
    "maritalStatus": "Single",
    "email": "jane.smith@jsc.gov.ng",
    "phoneNumber": "08098765432",
    "stateOfOrigin": "Abuja",
    "departmentId": "d1111111-1111-1111-1111-111111111111",
    "designation": "HR Officer",
    "employmentType": "Permanent",
    "employmentDate": "2024-01-15",
    "gradeLevel": 7,
    "step": 2,
    "currentBasicSalary": 260000,
    "bankName": "Access Bank",
    "accountNumber": "0123456789",
    "accountName": "Jane Smith"
  }'
```

## 🐳 Docker Commands

```bash
# Build image
docker build -t jsc-pms-backend .

# Run container
docker run -p 3000:3000 --env-file .env jsc-pms-backend

# Run with specific environment
docker run -p 3000:3000 \
  -e SUPABASE_URL=https://xxx.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=xxx \
  -e DATABASE_URL=postgresql://xxx \
  -e JWT_SECRET=xxx \
  jsc-pms-backend

# View logs
docker logs -f {container_id}

# Stop container
docker stop {container_id}
```

## 📊 Useful SQL Queries

```sql
-- Get staff count by department
SELECT d.name, d.code, COUNT(s.id) as staff_count
FROM departments d
LEFT JOIN staff s ON s.department_id = d.id AND s.status = 'active'
GROUP BY d.id, d.name, d.code
ORDER BY staff_count DESC;

-- Get staff count by grade level
SELECT grade_level, COUNT(*) as count
FROM staff
WHERE status = 'active'
GROUP BY grade_level
ORDER BY grade_level;

-- View recent payroll batches
SELECT 
  batch_number,
  payroll_month,
  total_staff,
  total_gross,
  total_net,
  status,
  created_at
FROM payroll_batches
ORDER BY created_at DESC
LIMIT 10;

-- View staff with bank details
SELECT 
  staff_number,
  first_name,
  last_name,
  bank_name,
  account_number,
  account_name
FROM staff
WHERE status = 'active' AND bank_name IS NOT NULL;

-- View cooperative members
SELECT 
  s.staff_number,
  s.first_name,
  s.last_name,
  c.name as cooperative_name,
  cm.monthly_contribution,
  cm.total_contributions
FROM cooperative_members cm
JOIN staff s ON cm.staff_id = s.id
JOIN cooperatives c ON cm.cooperative_id = c.id
WHERE cm.status = 'active';
```

## 🔍 Debugging

```bash
# Check backend logs
npm run start:dev

# Check database connection
# In Supabase SQL Editor:
SELECT 1;

# Test API health
curl http://localhost:3000/api/v1/health

# View environment variables (without sensitive data)
node -e "console.log(process.env)" | grep -v "SECRET\|PASSWORD\|KEY"
```

## 🛠️ Development Commands

```bash
# Start development server
npm run start:dev

# Build for production
npm run build

# Run production build
npm run start:prod

# Run tests
npm run test

# Generate password hash
node backend/scripts/hash-password.js mypassword

# Format code
npm run format

# Lint code
npm run lint
```

## 📝 Environment Variables Template

```env
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres

# JWT
JWT_SECRET=min-32-characters-random-string
JWT_EXPIRATION=24h

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

## 🎯 Quick Test Checklist

- [ ] Backend starts without errors
- [ ] Can access Swagger UI at /api/docs
- [ ] Can login with admin@jsc.gov.ng
- [ ] Can create a new staff member
- [ ] Can list all staff
- [ ] Can get staff by ID
- [ ] Can update staff information
- [ ] Can view staff statistics

## 📞 Quick Links

- **Swagger UI**: http://localhost:3000/api/docs
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Database Connection**: Via Supabase SQL Editor

## 🚨 Common Issues

**Issue**: Cannot connect to database
**Solution**: Check DATABASE_URL and Supabase project status

**Issue**: JWT token expired
**Solution**: Login again to get new token

**Issue**: 403 Forbidden
**Solution**: Check user role has permission for the endpoint

**Issue**: Validation error
**Solution**: Check required fields in DTO match request body

---

**Need more help?** See PRODUCTION_SETUP_GUIDE.md or backend/README.md
