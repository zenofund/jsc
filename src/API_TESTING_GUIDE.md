# 🧪 JSC-PMS API Testing Guide

Complete guide to testing all API endpoints with real examples.

---

## 🚀 Quick Start

### 1. Start Backend Server

```bash
cd backend
npm run start:dev
```

Server runs on: `http://localhost:3000`

### 2. Access Swagger UI

Open browser: `http://localhost:3000/api/docs`

---

## 🔑 Authentication Flow

### Login & Get Token

```bash
# Login as Admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@jsc.gov.ng",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "u1111111-1111-1111-1111-111111111111",
    "email": "admin@jsc.gov.ng",
    "fullName": "System Administrator",
    "role": "Admin"
  }
}
```

**Save the token:**
```bash
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Get User Profile

```bash
curl -X GET http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer $TOKEN"
```

---

## 👥 Staff Management API

### Create New Staff

```bash
curl -X POST http://localhost:3000/api/v1/staff \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1985-06-15",
    "gender": "Male",
    "maritalStatus": "Married",
    "phoneNumber": "08012345678",
    "email": "john.doe@jsc.gov.ng",
    "residentialAddress": "123 Main Street, Abuja",
    "stateOfOrigin": "Lagos",
    "lgaOfOrigin": "Lagos Island",
    "nationality": "Nigerian",
    "departmentId": "b1111111-1111-1111-1111-111111111111",
    "designation": "Senior Legal Officer",
    "employmentType": "Permanent",
    "employmentDate": "2020-01-15",
    "confirmationDate": "2020-07-15",
    "gradeLevel": 10,
    "step": 3,
    "currentBasicSalary": 600000,
    "bankName": "First Bank",
    "accountNumber": "1234567890",
    "accountName": "John Doe",
    "bvn": "12345678901",
    "taxId": "TAX-2020-001",
    "pensionPin": "PEN-12345",
    "nhfNumber": "NHF-67890",
    "nokName": "Jane Doe",
    "nokRelationship": "Wife",
    "nokPhone": "08098765432",
    "nokAddress": "123 Main Street, Abuja"
  }'
```

**Response:**
```json
{
  "id": "staff-uuid",
  "staff_number": "JSC/2025/0001",
  "first_name": "John",
  "last_name": "Doe",
  "grade_level": 10,
  "step": 3,
  "current_basic_salary": "600000.00",
  "status": "active",
  "created_at": "2025-01-15T10:30:00Z"
}
```

### List All Staff (Paginated)

```bash
# Basic list
curl -X GET "http://localhost:3000/api/v1/staff?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# With search
curl -X GET "http://localhost:3000/api/v1/staff?search=john&status=active" \
  -H "Authorization: Bearer $TOKEN"

# Filter by department
curl -X GET "http://localhost:3000/api/v1/staff?departmentId=d1111111-1111-1111-1111-111111111111" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Staff by ID

```bash
curl -X GET http://localhost:3000/api/v1/staff/staff-uuid \
  -H "Authorization: Bearer $TOKEN"
```

### Get Staff by Staff Number

```bash
curl -X GET "http://localhost:3000/api/v1/staff/by-number/JSC/2025/0001" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Staff Statistics

```bash
curl -X GET http://localhost:3000/api/v1/staff/statistics \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "overview": {
    "total_staff": 150,
    "active_staff": 140,
    "on_leave": 5,
    "retired": 3,
    "permanent": 120,
    "contract": 20,
    "total_departments": 5
  },
  "byDepartment": [
    {"name": "Legal Services", "code": "LEGAL", "staff_count": 45},
    {"name": "Finance & Accounts", "code": "FIN", "staff_count": 30}
  ],
  "byGrade": [
    {"grade_level": 7, "count": 20},
    {"grade_level": 8, "count": 35},
    {"grade_level": 10, "count": 40}
  ]
}
```

### Update Staff

```bash
curl -X PATCH http://localhost:3000/api/v1/staff/staff-uuid \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "designation": "Chief Legal Officer",
    "gradeLevel": 12,
    "step": 1,
    "currentBasicSalary": 750000
  }'
```

---

## 💼 Payroll Processing API

### Complete Payroll Flow Example

#### Step 1: Create Payroll Batch

```bash
curl -X POST http://localhost:3000/api/v1/payroll/batches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payrollMonth": "2025-01",
    "periodStart": "2025-01-01",
    "periodEnd": "2025-01-31"
  }'
```

**Response:**
```json
{
  "id": "batch-uuid",
  "batch_number": "PAY/2025/01/1234",
  "payroll_month": "2025-01",
  "period_start": "2025-01-01",
  "period_end": "2025-01-31",
  "total_staff": 0,
  "status": "draft",
  "created_at": "2025-01-15T10:00:00Z"
}
```

**Save batch ID:**
```bash
export BATCH_ID="batch-uuid"
```

#### Step 2: Generate Payroll Lines (BULK - 800+ Staff)

```bash
curl -X POST http://localhost:3000/api/v1/payroll/batches/$BATCH_ID/generate-lines \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "batch_id": "batch-uuid",
  "total_staff": 150,
  "total_gross": 45000000.00,
  "total_deductions": 8500000.00,
  "total_net": 36500000.00,
  "processing_time_ms": 2847
}
```

**Processing Time: ~3 seconds for 800 staff!** 🚀

#### Step 3: View Payroll Lines

```bash
# Get all lines for batch
curl -X GET "http://localhost:3000/api/v1/payroll/batches/$BATCH_ID/lines?page=1&limit=50" \
  -H "Authorization: Bearer $TOKEN"

# Search specific staff
curl -X GET "http://localhost:3000/api/v1/payroll/batches/$BATCH_ID/lines?search=JSC/2025/0001" \
  -H "Authorization: Bearer $TOKEN"
```

**Sample Payroll Line:**
```json
{
  "id": "line-uuid",
  "staff_number": "JSC/2025/0001",
  "staff_name": "John Doe",
  "grade_level": 10,
  "step": 3,
  "basic_salary": 600000.00,
  "allowances": [
    {"code": "HRA", "name": "Housing Allowance", "amount": 240000.00, "is_taxable": true},
    {"code": "TRA", "name": "Transport Allowance", "amount": 120000.00, "is_taxable": true},
    {"code": "UTL", "name": "Utility Allowance", "amount": 90000.00, "is_taxable": true},
    {"code": "MEL", "name": "Meal Allowance", "amount": 30000.00, "is_taxable": false},
    {"code": "FUR", "name": "Furniture Allowance", "amount": 60000.00, "is_taxable": true}
  ],
  "deductions": [
    {"code": "TAX", "name": "PAYE Tax", "amount": 89166.67},
    {"code": "PEN", "name": "Pension", "amount": 48000.00},
    {"code": "NHF", "name": "NHF", "amount": 15000.00}
  ],
  "gross_pay": 1140000.00,
  "total_deductions": 152166.67,
  "net_pay": 987833.33,
  "tax_details": {
    "taxable_income": 1110000.00,
    "monthly_tax": 89166.67,
    "tax_breakdown": [...]
  }
}
```

#### Step 4: Submit for Approval

```bash
curl -X POST http://localhost:3000/api/v1/payroll/batches/$BATCH_ID/submit \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "message": "Batch submitted for approval successfully"
}
```

**Batch Status Changes:**
- `draft` → `pending_review`
- Creates 3 approval stages (HR, Finance, Admin)

#### Step 5: Approve Batch (Stage 1 - HR Manager)

Login as HR Manager:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hr.manager@jsc.gov.ng",
    "password": "password123"
  }'

export HR_TOKEN="hr-manager-token"
```

Approve:
```bash
curl -X POST http://localhost:3000/api/v1/payroll/batches/$BATCH_ID/approve \
  -H "Authorization: Bearer $HR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approved",
    "comments": "Verified all staff records. Approved for finance review."
  }'
```

**Repeat for Stage 2 (Accountant) and Stage 3 (Admin)**

#### Step 6: Lock Batch (Admin Only)

```bash
curl -X POST http://localhost:3000/api/v1/payroll/batches/$BATCH_ID/lock \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "message": "Batch locked successfully"
}
```

**After locking:**
- Batch cannot be modified
- Status: `locked`
- Ready for payment execution

---

## 💰 Allowances API

### Create Global Allowance

```bash
curl -X POST http://localhost:3000/api/v1/allowances/global \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "CAR",
    "name": "Car Allowance",
    "description": "Monthly car maintenance allowance",
    "type": "fixed",
    "amount": 50000,
    "isTaxable": true,
    "appliesToAll": false
  }'
```

### Create Staff-Specific Allowance

```bash
curl -X POST http://localhost:3000/api/v1/allowances/staff \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "staff-uuid",
    "allowanceCode": "SPECIAL",
    "allowanceName": "Special Duty Allowance",
    "type": "fixed",
    "amount": 75000,
    "isTaxable": true,
    "startMonth": "2025-01",
    "endMonth": "2025-06",
    "frequency": "monthly"
  }'
```

### Get Staff Allowances

```bash
curl -X GET http://localhost:3000/api/v1/allowances/staff/staff-uuid \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📉 Deductions API

### Create Global Deduction

```bash
curl -X POST http://localhost:3000/api/v1/deductions/global \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "UNION",
    "name": "Union Dues",
    "description": "Monthly union membership dues",
    "type": "percentage",
    "percentage": 1.5,
    "appliesToAll": true
  }'
```

### Create Staff-Specific Deduction

```bash
curl -X POST http://localhost:3000/api/v1/deductions/staff \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "staff-uuid",
    "deductionCode": "GARNISH",
    "deductionName": "Court Garnishment",
    "type": "fixed",
    "amount": 50000,
    "startMonth": "2025-01",
    "endMonth": "2025-12",
    "frequency": "monthly"
  }'
```

---

## 🏢 Departments API

### List All Departments

```bash
curl -X GET http://localhost:3000/api/v1/departments \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
[
  {
    "id": "d1111111-1111-1111-1111-111111111111",
    "name": "Human Resources",
    "code": "HR",
    "description": "Manages staff recruitment, development, and welfare",
    "status": "active"
  },
  {
    "id": "d2222222-2222-2222-2222-222222222222",
    "name": "Finance & Accounts",
    "code": "FIN",
    "description": "Handles financial planning, budgeting, and accounting",
    "status": "active"
  }
]
```

---

## 🧪 Testing Scenarios

### Scenario 1: Complete Monthly Payroll

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@jsc.gov.ng","password":"password123"}' \
  | jq -r '.accessToken')

# 2. Create batch
BATCH_ID=$(curl -s -X POST http://localhost:3000/api/v1/payroll/batches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payrollMonth":"2025-01","periodStart":"2025-01-01","periodEnd":"2025-01-31"}' \
  | jq -r '.id')

# 3. Generate lines (800+ staff in ~3 seconds!)
curl -X POST http://localhost:3000/api/v1/payroll/batches/$BATCH_ID/generate-lines \
  -H "Authorization: Bearer $TOKEN"

# 4. Submit
curl -X POST http://localhost:3000/api/v1/payroll/batches/$BATCH_ID/submit \
  -H "Authorization: Bearer $TOKEN"

# 5. Approve (repeat for all stages)
curl -X POST http://localhost:3000/api/v1/payroll/batches/$BATCH_ID/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"approved","comments":"Approved"}'

# 6. Lock
curl -X POST http://localhost:3000/api/v1/payroll/batches/$BATCH_ID/lock \
  -H "Authorization: Bearer $TOKEN"
```

### Scenario 2: Bulk Staff Import

```bash
curl -X POST http://localhost:3000/api/v1/staff/bulk-import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "firstName": "Staff",
      "lastName": "One",
      "dateOfBirth": "1990-01-01",
      "gender": "Male",
      "maritalStatus": "Single",
      "stateOfOrigin": "Lagos",
      "departmentId": "d1111111-1111-1111-1111-111111111111",
      "designation": "Officer I",
      "employmentType": "Permanent",
      "employmentDate": "2024-01-01",
      "gradeLevel": 7,
      "step": 1,
      "currentBasicSalary": 250000
    },
    {
      "firstName": "Staff",
      "lastName": "Two",
      ...
    }
  ]'
```

---

## 📊 Response Codes

| Code | Meaning | When It Happens |
|------|---------|-----------------|
| 200 | OK | Successful GET/PATCH/DELETE |
| 201 | Created | Successful POST |
| 400 | Bad Request | Validation error, duplicate data |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Internal server error |

---

## 🎯 Performance Testing

### Test Bulk Payroll (800 Staff)

```bash
# Measure time
time curl -X POST http://localhost:3000/api/v1/payroll/batches/$BATCH_ID/generate-lines \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Result:** < 5 seconds

### Load Testing with Apache Bench

```bash
# 100 concurrent requests
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/staff
```

---

## 🔍 Troubleshooting

### Common Issues

**401 Unauthorized**
```bash
# Token expired - login again
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login ...)
```

**400 Bad Request - Validation Error**
```json
{
  "statusCode": 400,
  "message": ["email must be a valid email"],
  "error": "Bad Request"
}
```
→ Check request body matches DTO requirements

**403 Forbidden**
```json
{
  "statusCode": 403,
  "message": "You do not have permission to access this resource"
}
```
→ Login with correct role (e.g., Admin for batch locking)

---

## 📝 Postman Collection

Import this collection to Postman:

1. Open Postman
2. Import → Link
3. Use Swagger JSON: `http://localhost:3000/api/docs-json`
4. Set environment variable: `TOKEN` = your access token

---

## ✅ Testing Checklist

- [ ] Can login successfully
- [ ] Can create staff record
- [ ] Can search and filter staff
- [ ] Can create payroll batch
- [ ] Can generate payroll lines in < 5 seconds
- [ ] Can submit batch for approval
- [ ] Can approve batch at each stage
- [ ] Can lock approved batch
- [ ] Can create allowances and deductions
- [ ] Can view statistics and reports

---

**Need help?** Check [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) or Swagger UI at `/api/docs`