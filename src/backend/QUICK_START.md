# 🚀 JSC-PMS Backend - Quick Start Guide

## ⚡ **Get Started in 3 Minutes**

---

## Step 1: Install Dependencies (30 seconds)

```bash
cd backend
npm install
```

---

## Step 2: Verify Configuration (10 seconds)

Your `.env` file is already configured! ✅

```env
SUPABASE_URL=https://joaxrcnbruktgdfmjqus.supabase.co ✅
SUPABASE_SERVICE_ROLE_KEY=configured ✅
DATABASE_URL=configured ✅
JWT_SECRET=configured ✅
```

---

## Step 3: Start the Server (10 seconds)

```bash
npm run start:dev
```

You'll see:

```
[Nest] 12345  - 01/15/2024, 10:30:00 AM   LOG [NestApplication] Nest application successfully started
[Nest] 12345  - 01/15/2024, 10:30:00 AM   LOG [DatabaseService] ✅ PostgreSQL connection established successfully
[Nest] 12345  - 01/15/2024, 10:30:00 AM   LOG [NestApplication] 🚀 Server running on http://localhost:3000
```

---

## Step 4: Test Database Connection (5 seconds)

```bash
curl http://localhost:3000/api/v1/health/database
```

Expected:
```json
{
  "database": "connected",
  "message": "✅ PostgreSQL connection successful"
}
```

---

## Step 5: Open Swagger UI (5 seconds)

Open your browser:

```
http://localhost:3000/api/docs
```

You'll see **85 interactive API endpoints**! 🎉

---

## 🎯 **Test Your First API Call**

### Option A: Using Swagger UI (Easiest)

1. Open: http://localhost:3000/api/docs
2. Find **Auth** section
3. Click `POST /auth/login`
4. Click "Try it out"
5. Enter credentials:
   ```json
   {
     "email": "admin@jsc.gov.ng",
     "password": "your-password"
   }
   ```
6. Click "Execute"
7. Copy the `access_token`
8. Click "Authorize" button (top right)
9. Paste token
10. Now test any endpoint!

### Option B: Using cURL

```bash
# 1. Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@jsc.gov.ng",
    "password": "your-password"
  }'

# Copy the access_token from response

# 2. Get all departments (no auth needed)
curl http://localhost:3000/api/v1/departments

# 3. Get all staff (with auth)
curl http://localhost:3000/api/v1/staff \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 📊 **What You Have Now**

```
✅ NestJS server running on http://localhost:3000
✅ Connected to live Supabase database
✅ 85 API endpoints ready
✅ Swagger UI documentation
✅ JWT authentication working
✅ No hardcoded data - all from Supabase
```

---

## 🎯 **Quick Reference**

### **Most Used Endpoints**

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/health/database` | GET | Test DB | ❌ No |
| `/auth/login` | POST | Login | ❌ No |
| `/departments` | GET | List departments | ❌ No |
| `/staff` | GET | List staff | ✅ Yes |
| `/staff` | POST | Create staff | ✅ Yes |
| `/staff/bulk` | POST | Import 800+ staff | ✅ Yes |
| `/payroll/batches` | POST | Create payroll | ✅ Yes |
| `/payroll/batches/:id/process` | POST | Process payroll | ✅ Yes |
| `/cooperatives` | GET | List cooperatives | ✅ Yes |
| `/loans/applications` | GET | List loans | ✅ Yes |
| `/leave/requests` | GET | List leave requests | ✅ Yes |
| `/notifications/me` | GET | My notifications | ✅ Yes |
| `/audit` | GET | Audit trail | ✅ Yes |

---

## 📁 **File Locations**

```
backend/
├── src/modules/
│   ├── auth/          ← Login, profile, password
│   ├── staff/         ← Staff management
│   ├── departments/   ← Departments
│   ├── payroll/       ← Payroll processing
│   ├── allowances/    ← Allowances
│   ├── deductions/    ← Deductions
│   ├── cooperatives/  ← Cooperatives
│   ├── loans/         ← Loans
│   ├── leave/         ← Leave management
│   ├── notifications/ ← Notifications
│   └── audit/         ← Audit trail
│
├── .env              ← Credentials (NEVER commit!)
├── API_ENDPOINTS.md  ← Complete API docs
└── README.md         ← Full documentation
```

---

## 🐛 **Troubleshooting**

### **Server won't start**

```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process if needed
kill -9 <PID>

# Or use different port
PORT=3001 npm run start:dev
```

### **Database connection failed**

```bash
# Check .env file exists
ls -la .env

# Verify Supabase credentials
cat .env | grep SUPABASE
```

### **401 Unauthorized errors**

```bash
# Make sure you're logged in and using the token
# Token expires after 24 hours - login again
```

---

## 📚 **Learn More**

- **Complete API Docs**: [API_ENDPOINTS.md](./API_ENDPOINTS.md)
- **Module Details**: [MODULE_SUMMARY.md](./MODULE_SUMMARY.md)
- **Full Documentation**: [README.md](./README.md)
- **Database Schema**: `/database/schema.sql`

---

## 🎉 **You're Ready!**

Your backend is now running with:

```
🚀 Server: http://localhost:3000
📚 Swagger: http://localhost:3000/api/docs
💾 Database: Live Supabase connection
🔐 Auth: JWT tokens
📊 Endpoints: 85 live APIs
```

---

## 🔥 **Common Workflows**

### **1. Add a Staff Member**

```bash
# Via Swagger UI: POST /staff
# Via cURL:
curl -X POST http://localhost:3000/api/v1/staff \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "departmentId": "dept-uuid",
    "designation": "Senior Officer",
    "employmentType": "permanent",
    "employmentDate": "2024-01-01",
    "currentBasicSalary": 250000,
    "stateOfOrigin": "Lagos"
  }'
```

### **2. Bulk Import Staff**

```bash
curl -X POST http://localhost:3000/api/v1/staff/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "staff": [
      {...staff1...},
      {...staff2...},
      {...800 more...}
    ]
  }'
```

### **3. Process Monthly Payroll**

```bash
# 1. Create batch
curl -X POST http://localhost:3000/api/v1/payroll/batches \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"month": 1, "year": 2024}'

# 2. Process (bulk insert 800+ records)
curl -X POST http://localhost:3000/api/v1/payroll/batches/BATCH_ID/process \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **4. Check Audit Trail**

```bash
curl http://localhost:3000/api/v1/audit?page=1&limit=50 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 💡 **Pro Tips**

1. **Use Swagger UI** for testing - it's interactive!
2. **Check logs** in terminal for debugging
3. **View data** in Supabase dashboard
4. **Save tokens** - they expire after 24h
5. **Use pagination** on list endpoints

---

## ⚠️ **Important**

- ✅ `.env` file is already configured
- ❌ **NEVER** commit `.env` to Git
- ✅ All data is LIVE from Supabase
- ✅ No mock/fake data anywhere
- ✅ Ready for 800+ staff members

---

## 🎊 **Next Steps**

1. ✅ **Backend Running** ← You are here!
2. ⏭️ Deploy to Railway/Render
3. ⏭️ Build React frontend
4. ⏭️ Connect frontend to API
5. ⏭️ Go live!

---

**Happy coding! 🚀**

Questions? Check the documentation:
- [API_ENDPOINTS.md](./API_ENDPOINTS.md) - All 85 endpoints
- [MODULE_SUMMARY.md](./MODULE_SUMMARY.md) - Module details
- [README.md](./README.md) - Complete guide
