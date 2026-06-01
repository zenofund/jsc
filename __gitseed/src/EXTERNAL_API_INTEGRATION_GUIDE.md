# 🔌 External API Integration Guide
## JSC Payroll System - Cooperative System Integration

---

## 📋 **Overview**

The JSC Payroll System now has a **complete External API** that allows third-party systems (like your Cooperative Management System) to:

✅ **Read staff data** - Get list of staff members  
✅ **Create salary deductions** - Automatically deduct cooperative contributions  
✅ **Track deduction status** - Monitor when deductions are processed  
✅ **Receive webhooks** - Get notified when payroll is completed  
✅ **Manage payroll periods** - Query active payroll batches  

---

## 🎯 **Use Case: Cooperative Management System**

### **How It Works:**

1. **Cooperative System requests staff list**
   - Gets all active JSC staff members
   - Identifies cooperative members

2. **Cooperative System creates deductions**
   - For each member, create monthly contribution deduction
   - e.g., ₦5,000 monthly cooperative dues

3. **JSC Payroll processes payroll**
   - Deductions are included in salary calculations
   - Staff net pay is reduced by cooperative amount

4. **JSC sends webhook notification**
   - Cooperative System receives webhook: `payroll.completed`
   - Knows total amount collected
   - Can reconcile payments

5. **Cooperative System processes collections**
   - Credits member accounts
   - Generates reports

---

## 🔐 **Security: API Key Authentication**

### **Step 1: Generate API Key (Admin Only)**

**Endpoint:** `POST /api/v1/api-keys`

**Headers:**
```
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Cooperative Management System",
  "description": "Integration for automatic cooperative deductions",
  "scopes": [
    "read:staff",
    "write:deductions",
    "read:deductions",
    "read:payroll",
    "manage:webhooks"
  ],
  "rateLimitPerHour": 1000,
  "ipWhitelist": ["203.0.113.10", "203.0.113.11"],
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Cooperative Management System",
  "api_key_prefix": "jsc_live_a1b2c3d",
  "apiKey": "jsc_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
  "scopes": ["read:staff", "write:deductions", ...],
  "status": "active",
  "rateLimitPerHour": 1000,
  "created_at": "2025-01-01T00:00:00Z",
  "warning": "Save this API key now. You will not be able to see it again."
}
```

⚠️ **IMPORTANT:** Save the `apiKey` value immediately. It will never be shown again!

---

## 📚 **API Endpoints**

### **Base URL**
```
https://jsc-payroll.gov.ng/api/v1/external/v1
```

### **Authentication**
All requests require the API key in the header:
```
X-API-Key: jsc_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

---

### **1. Get Staff List**

**Endpoint:** `GET /external/v1/staff`

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 50, max: 100)
- `search` (optional) - Search by name or staff number
- `departmentId` (optional) - Filter by department
- `status` (optional) - Filter by status (default: active)

**Headers:**
```
X-API-Key: jsc_live_...
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid-staff-1",
      "staff_number": "JSC/2025/0001",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@jsc.gov.ng",
      "department_id": "uuid-dept",
      "department_name": "Administration",
      "designation": "Administrative Officer",
      "grade_level": 7,
      "step": 5,
      "current_basic_salary": 150000.00,
      "bank_name": "First Bank",
      "account_number": "1234567890"
    },
    // ... more staff
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 850,
    "totalPages": 17
  }
}
```

**Example (curl):**
```bash
curl -X GET "https://jsc-payroll.gov.ng/api/v1/external/v1/staff?page=1&limit=50" \
  -H "X-API-Key: jsc_live_..."
```

---

### **2. Get Single Staff Details**

**Endpoint:** `GET /external/v1/staff/:id`

**Headers:**
```
X-API-Key: jsc_live_...
```

**Response:**
```json
{
  "id": "uuid-staff-1",
  "staff_number": "JSC/2025/0001",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@jsc.gov.ng",
  "department_id": "uuid-dept",
  "department_name": "Administration",
  "designation": "Administrative Officer",
  "grade_level": 7,
  "step": 5,
  "current_basic_salary": 150000.00,
  "bank_name": "First Bank",
  "account_number": "1234567890",
  "account_name": "John Doe"
}
```

---

### **3. Create Salary Deduction**

**Endpoint:** `POST /external/v1/deductions`

**Headers:**
```
X-API-Key: jsc_live_...
Content-Type: application/json
```

**Request Body:**
```json
{
  "staffId": "uuid-staff-1",
  "amount": 5000.00,
  "description": "Monthly Cooperative Contribution - January 2025",
  "externalReference": "COOP-MEMBER-12345",
  "externalSystem": "cooperative_system",
  "metadata": {
    "cooperative_id": "COOP-001",
    "member_id": "MEM-12345",
    "contribution_type": "monthly_dues"
  }
}
```

**Response:**
```json
{
  "id": "uuid-deduction-1",
  "staffId": "uuid-staff-1",
  "amount": 5000.00,
  "description": "Monthly Cooperative Contribution - January 2025",
  "status": "pending",
  "externalReference": "COOP-MEMBER-12345",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

**Statuses:**
- `pending` - Created, waiting for next payroll
- `processed` - Deducted from salary
- `failed` - Error occurred
- `cancelled` - Cancelled before processing

---

### **4. Get Deduction Status**

**Endpoint:** `GET /external/v1/deductions/:id`

**Headers:**
```
X-API-Key: jsc_live_...
```

**Response:**
```json
{
  "id": "uuid-deduction-1",
  "staff_id": "uuid-staff-1",
  "staff_number": "JSC/2025/0001",
  "first_name": "John",
  "last_name": "Doe",
  "amount": 5000.00,
  "description": "Monthly Cooperative Contribution - January 2025",
  "status": "processed",
  "external_reference": "COOP-MEMBER-12345",
  "external_system": "cooperative_system",
  "processed_at": "2025-01-31T16:45:00Z",
  "payroll_batch_id": "uuid-batch",
  "batch_number": "PAY/2025/01/1234",
  "payroll_month": "2025-01"
}
```

---

### **5. Cancel Pending Deduction**

**Endpoint:** `DELETE /external/v1/deductions/:id`

**Headers:**
```
X-API-Key: jsc_live_...
```

**Response:**
```json
{
  "id": "uuid-deduction-1",
  "status": "cancelled",
  "message": "Deduction cancelled successfully"
}
```

**Note:** Only deductions with status `pending` can be cancelled.

---

### **6. Get Payroll Periods**

**Endpoint:** `GET /external/v1/payroll-periods`

**Headers:**
```
X-API-Key: jsc_live_...
```

**Response:**
```json
[
  {
    "id": "uuid-batch-1",
    "batch_number": "PAY/2025/01/1234",
    "payroll_month": "2025-01",
    "period_start": "2025-01-01",
    "period_end": "2025-01-31",
    "status": "locked",
    "created_at": "2025-01-01T08:00:00Z"
  },
  {
    "id": "uuid-batch-2",
    "batch_number": "PAY/2025/02/5678",
    "payroll_month": "2025-02",
    "period_start": "2025-02-01",
    "period_end": "2025-02-28",
    "status": "draft",
    "created_at": "2025-02-01T08:00:00Z"
  }
]
```

---

## 🔔 **Webhooks**

### **What are Webhooks?**
Webhooks allow the Cooperative System to receive real-time notifications when events happen in the JSC Payroll System.

### **Step 1: Register Webhook Endpoint**

**Endpoint:** `POST /external/v1/webhooks`

**Headers:**
```
X-API-Key: jsc_live_...
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Cooperative Payroll Completion Webhook",
  "url": "https://cooperative-system.com/api/webhooks/payroll-completed",
  "events": ["payroll.completed"],
  "secret": "your-webhook-secret-key-for-signature-verification"
}
```

**Response:**
```json
{
  "id": "uuid-webhook",
  "name": "Cooperative Payroll Completion Webhook",
  "url": "https://cooperative-system.com/api/webhooks/payroll-completed",
  "events": ["payroll.completed"],
  "status": "active",
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

### **Step 2: Receive Webhook Notifications**

When payroll is locked/completed, JSC sends a POST request to your webhook URL:

**Webhook Payload:**
```json
{
  "event": "payroll.completed",
  "timestamp": "2025-01-31T16:45:00Z",
  "payroll": {
    "batch_id": "uuid-batch",
    "batch_number": "PAY/2025/01/1234",
    "payroll_month": "2025-01",
    "period_start": "2025-01-01",
    "period_end": "2025-01-31",
    "total_staff": 850,
    "total_gross": 127500000.00,
    "total_deductions": 25400000.00,
    "total_net": 102100000.00,
    "locked_at": "2025-01-31T16:45:00Z"
  },
  "external_deductions": [
    {
      "system": "cooperative_system",
      "count": 450,
      "total_amount": 2250000.00
    }
  ]
}
```

**Headers Sent:**
```
Content-Type: application/json
X-JSC-Signature: sha256=abc123... (HMAC signature for verification)
```

---

### **Step 3: Verify Webhook Signature**

To ensure the webhook is from JSC (not spoofed), verify the signature:

**Node.js Example:**
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return `sha256=${expectedSignature}` === signature;
}

// Express route example
app.post('/api/webhooks/payroll-completed', (req, res) => {
  const signature = req.headers['x-jsc-signature'];
  const payload = req.body;
  const secret = 'your-webhook-secret-key-for-signature-verification';
  
  if (!verifyWebhookSignature(payload, signature, secret)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process the webhook
  console.log('Payroll completed:', payload.payroll.batch_number);
  console.log('Cooperative deductions:', payload.external_deductions);
  
  // Credit cooperative members' accounts
  // Generate reports
  // Send notifications
  
  res.status(200).send('Webhook received');
});
```

---

## 🚀 **Complete Integration Example**

### **Cooperative System: Monthly Deduction Flow**

```javascript
const axios = require('axios');

const API_BASE = 'https://jsc-payroll.gov.ng/api/v1/external/v1';
const API_KEY = 'jsc_live_...';

// Step 1: Get all JSC staff
async function getAllStaff() {
  const response = await axios.get(`${API_BASE}/staff?limit=100`, {
    headers: { 'X-API-Key': API_KEY }
  });
  return response.data.data;
}

// Step 2: Filter cooperative members
function filterCooperativeMembers(staff, cooperativeMembers) {
  return staff.filter(s => 
    cooperativeMembers.some(cm => cm.staff_number === s.staff_number)
  );
}

// Step 3: Create deductions for each member
async function createMonthlyDeductions(members, month, year) {
  const results = [];
  
  for (const member of members) {
    try {
      const response = await axios.post(`${API_BASE}/deductions`, {
        staffId: member.id,
        amount: member.monthly_contribution_amount, // e.g., 5000
        description: `Cooperative Contribution - ${month} ${year}`,
        externalReference: member.cooperative_member_id,
        externalSystem: 'cooperative_system',
        metadata: {
          cooperative_id: 'COOP-001',
          member_id: member.cooperative_member_id,
          contribution_type: 'monthly_dues'
        }
      }, {
        headers: { 
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      results.push({
        staff: member.staff_number,
        success: true,
        deduction_id: response.data.id
      });
    } catch (error) {
      results.push({
        staff: member.staff_number,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

// Step 4: Run monthly deduction process
async function processMonthlyDeductions() {
  const month = 'January';
  const year = 2025;
  
  console.log(`Processing cooperative deductions for ${month} ${year}...`);
  
  // Get all JSC staff
  const allStaff = await getAllStaff();
  console.log(`Found ${allStaff.length} JSC staff members`);
  
  // Get cooperative members from your database
  const cooperativeMembers = await getCooperativeMembersFromDB();
  console.log(`Found ${cooperativeMembers.length} cooperative members`);
  
  // Filter staff who are cooperative members
  const members = filterCooperativeMembers(allStaff, cooperativeMembers);
  console.log(`${members.length} cooperative members are active JSC staff`);
  
  // Create deductions
  const results = await createMonthlyDeductions(members, month, year);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Deductions created: ${successful} successful, ${failed} failed`);
  
  return results;
}

// Step 5: Handle webhook when payroll is completed
app.post('/api/webhooks/payroll-completed', async (req, res) => {
  const payload = req.body;
  
  console.log('Payroll completed notification received');
  console.log(`Batch: ${payload.payroll.batch_number}`);
  console.log(`Month: ${payload.payroll.payroll_month}`);
  
  // Find cooperative deductions
  const coopDeductions = payload.external_deductions.find(
    ed => ed.system === 'cooperative_system'
  );
  
  if (coopDeductions) {
    console.log(`Cooperative deductions processed:`);
    console.log(`  Count: ${coopDeductions.count} members`);
    console.log(`  Total: ₦${coopDeductions.total_amount.toLocaleString()}`);
    
    // Credit cooperative account
    await creditCooperativeAccount(coopDeductions.total_amount);
    
    // Credit individual member accounts
    await creditMemberAccounts(payload.payroll.batch_id);
    
    // Generate reports
    await generateMonthlyReport(payload.payroll.payroll_month);
    
    // Send notifications to members
    await notifyMembers(payload.payroll.payroll_month);
  }
  
  res.status(200).send('Webhook processed');
});

// Run monthly deduction (e.g., on 1st of each month)
// cron.schedule('0 0 1 * *', processMonthlyDeductions);
```

---

## 📊 **Monitoring & Logs**

### **View API Usage**

**Endpoint:** `GET /api/v1/api-keys` (Admin only)

Shows all API keys, usage stats, and last used timestamp.

### **View API Call Logs**

All API calls are logged to `api_call_logs` table:

```sql
SELECT 
  method,
  endpoint,
  ip_address,
  response_status,
  execution_time_ms,
  created_at
FROM api_call_logs
WHERE api_key_id = 'uuid-api-key'
ORDER BY created_at DESC
LIMIT 100;
```

### **View Webhook Deliveries**

Track webhook delivery success/failure:

```sql
SELECT 
  event_type,
  status,
  http_status,
  error_message,
  created_at,
  delivered_at
FROM webhook_deliveries
WHERE webhook_endpoint_id = 'uuid-webhook'
ORDER BY created_at DESC;
```

---

## 🔒 **Security Best Practices**

1. ✅ **Store API Key Securely**
   - Never commit to source control
   - Use environment variables
   - Rotate keys periodically

2. ✅ **Use HTTPS Only**
   - All API calls must use HTTPS
   - Webhook URLs must be HTTPS

3. ✅ **Verify Webhook Signatures**
   - Always verify HMAC signature
   - Prevents spoofed webhooks

4. ✅ **IP Whitelisting**
   - Restrict API access to known IP addresses
   - Add cooperative system servers to whitelist

5. ✅ **Rate Limiting**
   - Default: 1000 requests/hour
   - Adjust based on needs

6. ✅ **Monitor Usage**
   - Review API call logs regularly
   - Alert on unusual activity

---

## 🎯 **API Scopes**

| Scope | Description |
|-------|-------------|
| `read:staff` | Read staff information |
| `write:deductions` | Create salary deductions |
| `read:deductions` | View deduction status |
| `read:payroll` | View payroll periods |
| `manage:webhooks` | Register webhooks |

---

## ❓ **Error Handling**

### **Common Error Responses:**

**401 Unauthorized:**
```json
{
  "statusCode": 401,
  "message": "Invalid API key",
  "error": "Unauthorized"
}
```

**404 Not Found:**
```json
{
  "statusCode": 404,
  "message": "Staff not found",
  "error": "Not Found"
}
```

**400 Bad Request:**
```json
{
  "statusCode": 400,
  "message": ["amount must be a positive number"],
  "error": "Bad Request"
}
```

**429 Rate Limit Exceeded:**
```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded. Try again later.",
  "error": "Too Many Requests"
}
```

---

## 📁 **Database Tables**

The integration uses these tables:

- `api_keys` - API key management
- `api_call_logs` - Audit trail of all API calls
- `webhook_endpoints` - Registered webhooks
- `webhook_deliveries` - Webhook delivery attempts
- `external_deductions` - Deductions created via API

---

## ✅ **Setup Checklist**

- [ ] Run database migration: `018_create_external_api_tables.sql`
- [ ] Create API key for Cooperative System (admin)
- [ ] Save API key securely
- [ ] Configure IP whitelist (optional)
- [ ] Implement webhook endpoint in Cooperative System
- [ ] Register webhook with JSC Payroll
- [ ] Test staff list endpoint
- [ ] Test deduction creation
- [ ] Test webhook reception
- [ ] Monitor API logs
- [ ] Schedule monthly deduction process

---

## 🎉 **You're All Set!**

Your Cooperative Management System can now:
✅ Automatically retrieve JSC staff data  
✅ Create monthly salary deductions  
✅ Receive real-time payroll completion notifications  
✅ Track deduction processing status  
✅ Reconcile cooperative contributions automatically  

**Any external system (not just cooperatives) can use this API for salary deductions!**

