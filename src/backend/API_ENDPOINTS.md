# JSC-PMS Backend API Endpoints

## 🎯 **API Base URL**
- **Local Development**: `http://localhost:3000/api/v1`
- **Production**: `https://your-domain.com/api/v1`

## 🔐 **Authentication**
All endpoints (except `/health/*` and `/auth/*`) require Bearer token authentication.

```
Authorization: Bearer <your-jwt-token>
```

---

## 📚 **Complete API Documentation**

### **Module Summary**

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Health | 3 | System health checks |
| Auth | 3 | Authentication & authorization |
| Departments | 2 | Department management |
| Staff | 9 | Staff CRUD & bulk operations |
| Salary Structures | 9 | Salary structure management |
| Allowances | 9 | Global & staff-specific allowances |
| Deductions | 9 | Global & staff-specific deductions |
| Payroll | 6 | Payroll batch processing |
| Cooperatives | 10 | Multi-cooperative management |
| Loans | 11 | Loan lifecycle management |
| Leave | 11 | Leave management system |
| Notifications | 13 | In-app notifications |
| Audit | 5 | Complete audit trail |
| Reports | 13 | Custom & standard reporting |
| **TOTAL** | **113** | **All with LIVE Supabase DB** |

---

## 1️⃣ **HEALTH MODULE** (3 endpoints)

### `GET /health`
Basic health check
```json
{ "status": "ok", "timestamp": "2024-01-15T10:30:00Z" }
```

### `GET /health/database`
Database connection check
```json
{ "database": "connected", "message": "PostgreSQL connection successful" }
```

### `GET /health/detailed`
Detailed system health
```json
{
  "status": "ok",
  "database": "connected",
  "uptime": 3600,
  "memory": {...}
}
```

---

## 2️⃣ **AUTH MODULE** (3 endpoints)

### `POST /auth/login`
User login
```json
{
  "email": "admin@jsc.gov.ng",
  "password": "password123"
}
```

### `GET /auth/profile`
Get current user profile

### `POST /auth/change-password`
Change password
```json
{
  "currentPassword": "old123",
  "newPassword": "new456"
}
```

---

## 3️⃣ **DEPARTMENTS MODULE** (2 endpoints)

### `GET /departments`
Get all active departments

### `GET /departments/:id`
Get department by ID

---

## 4️⃣ **STAFF MODULE** (9 endpoints)

### `POST /staff`
Create single staff member

### `POST /staff/bulk`
Bulk import staff (optimized for 800+ records)

### `GET /staff`
Get all staff with pagination & filters
- Query params: `page`, `limit`, `search`, `status`, `departmentId`, `employmentType`

### `GET /staff/:id`
Get staff by ID with full details

### `PUT /staff/:id`
Update staff information

### `PUT /staff/:id/status`
Update staff status (active/inactive/suspended)

### `DELETE /staff/:id`
Soft delete staff

### `GET /staff/:id/payroll-history`
Get staff payroll history

### `GET /staff/stats/overview`
Get staff statistics

---

## 5️⃣ **SALARY STRUCTURES MODULE** (9 endpoints)

### `POST /salary-structures`
Create salary structure
```json
{
  "name": "JSC Consolidated Salary Structure 2024",
  "code": "CONSAL-2024",
  "effective_date": "2024-01-01",
  "description": "Current consolidated salary structure",
  "grade_levels": [
    {
      "level": 1,
      "steps": [
        { "step": 1, "basic_salary": 70000 },
        { "step": 2, "basic_salary": 73200 },
        ...
      ]
    },
    ...
  ]
}
```

### `GET /salary-structures`
Get all salary structures with pagination
- Query params: `page`, `limit`, `status`

### `GET /salary-structures/active`
Get currently active salary structure

### `GET /salary-structures/code/:code`
Get salary structure by code

### `GET /salary-structures/:id`
Get salary structure by ID with full grade levels

### `GET /salary-structures/:id/salary/:gradeLevel/:step`
Get specific salary for a grade level and step
```json
{
  "gradeLevel": 7,
  "step": 5,
  "basicSalary": 135000,
  "structureName": "JSC Consolidated Salary Structure 2024",
  "structureCode": "CONSAL-2024"
}
```

### `PATCH /salary-structures/:id`
Update salary structure

### `DELETE /salary-structures/:id`
Deactivate salary structure (soft delete)

### `DELETE /salary-structures/:id/permanent`
Permanently delete salary structure (hard delete)

---

## 6️⃣ **ALLOWANCES MODULE** (9 endpoints)

### Global Allowances

#### `POST /allowances/global`
Create global allowance

#### `GET /allowances/global`
Get all global allowances

#### `GET /allowances/global/:id`
Get global allowance by ID

#### `PUT /allowances/global/:id`
Update global allowance

### Staff Allowances

#### `POST /allowances/staff`
Assign allowance to staff

#### `POST /allowances/staff/bulk`
Bulk assign allowances

#### `GET /allowances/staff/:staffId`
Get staff allowances

#### `PUT /allowances/staff/:id`
Update staff allowance

#### `DELETE /allowances/staff/:id`
Remove staff allowance

---

## 7️⃣ **DEDUCTIONS MODULE** (9 endpoints)

### Global Deductions

#### `POST /deductions/global`
Create global deduction

#### `GET /deductions/global`
Get all global deductions

#### `GET /deductions/global/:id`
Get global deduction by ID

#### `PUT /deductions/global/:id`
Update global deduction

### Staff Deductions

#### `POST /deductions/staff`
Assign deduction to staff

#### `POST /deductions/staff/bulk`
Bulk assign deductions

#### `GET /deductions/staff/:staffId`
Get staff deductions

#### `PUT /deductions/staff/:id`
Update staff deduction

#### `DELETE /deductions/staff/:id`
Remove staff deduction

---

## 8️⃣ **PAYROLL MODULE** (6 endpoints)

### `POST /payroll/batches`
Create payroll batch

### `GET /payroll/batches`
Get all payroll batches
- Query params: `status`, `month`, `year`, `page`, `limit`

### `GET /payroll/batches/:id`
Get payroll batch details

### `POST /payroll/batches/:id/process`
Process payroll batch (bulk insert 800+ records)

### `PUT /payroll/batches/:id/approve`
Approve payroll batch

### `GET /payroll/batches/:id/lines`
Get payroll lines for a batch

---

## 9️⃣ **COOPERATIVES MODULE** (10 endpoints)

### Cooperatives

#### `POST /cooperatives`
Create cooperative

#### `GET /cooperatives`
Get all cooperatives

#### `GET /cooperatives/:id`
Get cooperative with member count & contributions

#### `PUT /cooperatives/:id`
Update cooperative

### Members

#### `POST /cooperatives/members`
Add member to cooperative

#### `GET /cooperatives/:cooperativeId/members`
Get cooperative members

#### `GET /cooperatives/staff/:staffId/memberships`
Get staff cooperative memberships (multi-cooperative support)

#### `DELETE /cooperatives/:cooperativeId/members/:staffId`
Remove member from cooperative

### Contributions

#### `POST /cooperatives/contributions`
Record contribution

#### `GET /cooperatives/:cooperativeId/contributions`
Get cooperative contributions

#### `GET /cooperatives/members/:memberId/contributions`
Get member contribution history

---

## 🔟 **LOANS MODULE** (11 endpoints)

### Loan Types

#### `POST /loans/types`
Create loan type

#### `GET /loans/types`
Get all loan types

#### `GET /loans/types/:id`
Get loan type by ID

### Loan Applications

#### `POST /loans/applications`
Create loan application with guarantors

#### `GET /loans/applications`
Get all loan applications with filters

#### `GET /loans/applications/:id`
Get loan application with guarantors

#### `PUT /loans/applications/:id/approve`
Approve loan application

#### `PUT /loans/applications/:id/reject`
Reject loan application

### Disbursements

#### `POST /loans/disbursements`
Disburse loan

#### `GET /loans/disbursements`
Get all disbursements

#### `GET /loans/disbursements/:id/repayments`
Get repayment history

### Repayments

#### `POST /loans/repayments`
Record loan repayment

---

## 1️⃣1️⃣ **LEAVE MODULE** (11 endpoints)

### Leave Types

#### `POST /leave/types`
Create leave type

#### `GET /leave/types`
Get all leave types

#### `GET /leave/types/:id`
Get leave type by ID

### Leave Balances

#### `POST /leave/balances/initialize`
Initialize leave balances for all staff for a year

#### `GET /leave/balances/staff/:staffId`
Get staff leave balances

### Leave Requests

#### `POST /leave/requests`
Create leave request

#### `GET /leave/requests`
Get all leave requests with filters

#### `GET /leave/requests/:id`
Get leave request by ID

#### `PUT /leave/requests/:id/approve`
Approve leave request (auto-deduct from balance)

#### `PUT /leave/requests/:id/reject`
Reject leave request

#### `PUT /leave/requests/:id/cancel`
Cancel leave request (refund days if approved)

---

## 1️⃣2️⃣ **NOTIFICATIONS MODULE** (13 endpoints)

### Core Operations

#### `POST /notifications`
Create a single notification
```json
{
  "recipient_id": "user-uuid-or-all",
  "recipient_role": "admin",
  "type": "payroll",
  "category": "action_required",
  "title": "Payroll Batch Pending Review",
  "message": "Payroll batch PB-2024-01 requires your approval",
  "link": "/approvals",
  "entity_type": "payroll_batch",
  "entity_id": "batch-uuid",
  "metadata": { "batchNumber": "PB-2024-01" },
  "priority": "high",
  "action_label": "Review Now",
  "action_link": "/approvals",
  "created_by": "system",
  "expires_at": "2024-12-31T23:59:59Z"
}
```

#### `POST /notifications/bulk`
Create notifications for multiple users
```json
{
  "recipient_ids": ["user-1-uuid", "user-2-uuid", "user-3-uuid"],
  "type": "payroll",
  "category": "success",
  "title": "Payslip Available",
  "message": "Your payslip for December 2024 is ready",
  "link": "/payslips",
  "priority": "medium",
  "action_label": "View Payslip",
  "action_link": "/payslips"
}
```

#### `POST /notifications/role`
Create role-based notification (broadcast to all users with specific role)
```json
{
  "role": "cashier",
  "type": "bank_payment",
  "category": "action_required",
  "title": "Payment Batch Ready",
  "message": "Payment batch requires processing",
  "link": "/bank-payments",
  "priority": "urgent",
  "action_label": "Process Now",
  "action_link": "/bank-payments"
}
```

### Retrieval

#### `GET /notifications`
Get user notifications with optional filters
- Query params: `type`, `category`, `is_read`, `priority`, `from_date`, `to_date`
- Example: `/notifications?type=payroll&is_read=false&category=action_required`
- Returns notifications for current user including broadcast notifications

#### `GET /notifications/unread-count`
Get unread notification count for current user
```json
{
  "unreadCount": 5
}
```

#### `GET /notifications/:id`
Get notification by ID

#### `GET /notifications/entity/:entityType/:entityId`
Get notifications by entity
- Example: `/notifications/entity/payroll_batch/batch-uuid`

### Actions

#### `PUT /notifications/:id/read`
Mark notification as read
- Returns updated notification with `is_read: true` and `read_at` timestamp

#### `PUT /notifications/mark-all-read`
Mark all notifications as read for current user
```json
{
  "message": "All notifications marked as read"
}
```

### Deletion

#### `DELETE /notifications/:id`
Delete notification
- Only user's own notifications

#### `DELETE /notifications/read/all`
Delete all read notifications for current user
```json
{
  "message": "Deleted 15 read notifications",
  "count": 15
}
```

#### `DELETE /notifications/expired/cleanup`
Delete expired notifications (Admin utility)
- Removes all notifications past their `expires_at` date

### Notification Types
- `payroll` - Payroll-related notifications
- `leave` - Leave management notifications
- `promotion` - Promotion & arrears notifications
- `loan` - Loan application notifications
- `bank_payment` - Payment processing notifications
- `approval` - Approval workflow notifications
- `system` - System announcements
- `arrears` - Arrears calculations
- `document` - Document uploads

### Notification Categories
- `info` - Informational messages
- `success` - Success messages
- `warning` - Warning messages
- `error` - Error messages
- `action_required` - Requires user action

### Priority Levels
- `low` - Low priority
- `medium` - Medium priority (default)
- `high` - High priority
- `urgent` - Urgent (top of list)

---

## 1️⃣3️⃣ **AUDIT TRAIL MODULE** (5 endpoints)

### `POST /audit`
Log audit trail entry

### `GET /audit`
Get audit trail with filters
- Query params: `userId`, `action`, `entity`, `entityId`, `startDate`, `endDate`, `page`, `limit`

### `GET /audit/entity/:entity/:entityId`
Get audit trail for specific entity

### `GET /audit/user/:userId/activity`
Get user activity

### `GET /audit/statistics`
Get audit statistics
- Query params: `startDate`, `endDate`

---

## 1️⃣4️⃣ **REPORTS MODULE** (13 endpoints)

### Custom Reports

#### `POST /reports/custom`
Create custom report

#### `GET /reports/custom`
Get all custom reports

#### `GET /reports/custom/:id`
Get custom report by ID

#### `PUT /reports/custom/:id`
Update custom report

#### `DELETE /reports/custom/:id`
Delete custom report

### Standard Reports

#### `GET /reports/standard/payroll`
Get standard payroll report

#### `GET /reports/standard/allowances`
Get standard allowances report

#### `GET /reports/standard/deductions`
Get standard deductions report

#### `GET /reports/standard/loans`
Get standard loans report

#### `GET /reports/standard/leave`
Get standard leave report

#### `GET /reports/standard/cooperatives`
Get standard cooperatives report

#### `GET /reports/standard/audit`
Get standard audit report

---

## 🔄 **Bulk Operations**

The following endpoints support bulk operations for efficient processing of 800+ records:

1. **`POST /staff/bulk`** - Import multiple staff members
2. **`POST /allowances/staff/bulk`** - Assign allowances to multiple staff
3. **`POST /deductions/staff/bulk`** - Assign deductions to multiple staff
4. **`POST /payroll/batches/:id/process`** - Process payroll for all staff
5. **Cooperative Contributions** - Auto-linked during payroll processing
6. **Loan Repayments** - Auto-deducted during payroll processing

---

## 📊 **Response Format**

### Success Response
```json
{
  "id": "uuid",
  "field": "value",
  ...
}
```

### Paginated Response
```json
{
  "data": [...],
  "meta": {
    "total": 850,
    "page": 1,
    "limit": 20,
    "totalPages": 43
  }
}
```

### Error Response
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

---

## 🚀 **Quick Start**

### 1. Start the server
```bash
cd backend
npm run start:dev
```

### 2. Test database connection
```bash
curl http://localhost:3000/api/v1/health/database
```

### 3. Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@jsc.gov.ng","password":"password"}'
```

### 4. Use the token
```bash
export TOKEN="your-jwt-token-here"

curl http://localhost:3000/api/v1/staff \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Access Swagger UI
Open: `http://localhost:3000/api/docs`

---

## ✅ **Database Connection**

All endpoints execute **LIVE SQL queries** on your Supabase PostgreSQL database:

- **Database URL**: `https://joaxrcnbruktgdfmjqus.supabase.co`
- **Connection**: Direct PostgreSQL pool
- **No hardcoded data** - All data comes from Supabase tables
- **Real-time operations** - INSERT, SELECT, UPDATE, DELETE

---

## 📈 **Performance Optimization**

- ✅ Bulk insert operations for 800+ staff members
- ✅ Database connection pooling
- ✅ Indexed queries for fast search
- ✅ Pagination on all list endpoints
- ✅ Optimized JOIN queries
- ✅ Transaction support for payroll processing

---

## 🔒 **Security**

- ✅ JWT authentication on all protected routes
- ✅ Role-based access control (RBAC)
- ✅ SQL injection prevention (parameterized queries)
- ✅ Password hashing (bcrypt)
- ✅ Audit trail logging
- ✅ Input validation (class-validator)

---

## 📝 **Notes**

1. All dates should be in ISO 8601 format: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss.sssZ`
2. All numeric amounts are in Naira (₦)
3. UUIDs are used for all primary keys
4. Soft delete is used for staff (status = 'inactive')
5. All timestamps are stored in UTC

---

**Total Endpoints**: **113 Live API Endpoints** 🎉

All endpoints are connected to your live Supabase database and ready for testing!