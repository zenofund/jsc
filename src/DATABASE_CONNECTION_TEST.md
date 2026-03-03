# 🔌 Database Connection Testing Guide

## ✅ Good News: No supabase_connect Needed!

Your NestJS backend **doesn't need** the `supabase_connect` tool because:

1. ✅ It's a **server-side application** (not a frontend app)
2. ✅ It uses **environment variables** for configuration
3. ✅ It connects **automatically** when the server starts
4. ✅ You've already edited the `.env` file!

The `supabase_connect` tool is for **frontend web apps** built in Figma Make, not backend APIs.

---

## 🚀 How to Test Your Connection

### **Step 1: Start the Backend Server**

```bash
cd backend
npm install
npm run start:dev
```

**What to Look For:**

✅ **Success:**
```
[Nest] 12345  - 01/15/2025, 10:00:00 AM     LOG [DatabaseService] ✅ PostgreSQL connection established successfully
[Nest] 12345  - 01/15/2025, 10:00:00 AM     LOG [DatabaseService] ✅ Database service initialized
[Nest] 12345  - 01/15/2025, 10:00:00 AM     LOG [NestFactory] Starting Nest application...

╔═══════════════════════════════════════════════════════════╗
║   JSC Payroll Management System - Backend API            ║
║   🚀 Server running on: http://localhost:3000             ║
║   📚 API Documentation: http://localhost:3000/api/docs    ║
║   🌍 Environment: development                             ║
╚═══════════════════════════════════════════════════════════╝
```

❌ **Failure:**
```
[Nest] 12345  - ERROR [DatabaseService] Supabase configuration missing!
Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
```

---

### **Step 2: Test via Health Check Endpoints**

I've created 3 health check endpoints for you:

#### **A. Basic Health Check**
```bash
curl http://localhost:3000/api/v1/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "uptime": 123.45,
  "environment": "development"
}
```

#### **B. Database Connection Check**
```bash
curl http://localhost:3000/api/v1/health/database
```

**Expected Response (Success):**
```json
{
  "status": "ok",
  "database": "connected",
  "postgresql": {
    "version": "PostgreSQL 15.1 on x86_64-pc-linux-gnu...",
    "tables": 15
  },
  "supabase": {
    "url": "https://your-project.supabase.co",
    "configured": true
  },
  "timestamp": "2025-01-15T10:00:00.000Z"
}
```

**Expected Response (Failure):**
```json
{
  "status": "error",
  "database": "error",
  "message": "connect ECONNREFUSED...",
  "timestamp": "2025-01-15T10:00:00.000Z"
}
```

#### **C. Detailed Health Check**
```bash
curl http://localhost:3000/api/v1/health/detailed
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "uptime": 123.45,
  "environment": "development",
  "database": {
    "status": "ok",
    "database": "connected",
    "postgresql": {
      "version": "PostgreSQL 15.1...",
      "tables": 15
    },
    "supabase": {
      "url": "https://your-project.supabase.co",
      "configured": true
    }
  },
  "tables": {
    "users": 3,
    "staff": 0,
    "departments": 5,
    "allowances": 12,
    "deductions": 8
  },
  "configuration": {
    "port": 3000,
    "apiPrefix": "api/v1",
    "nodeEnv": "development",
    "corsConfigured": true,
    "jwtConfigured": true
  },
  "memory": {
    "used": "45 MB",
    "total": "128 MB"
  }
}
```

---

### **Step 3: Test via Swagger UI**

1. Open browser: **http://localhost:3000/api/docs**

2. Look for the **"Health"** section (should be first)

3. Click on **`GET /api/v1/health/database`**

4. Click **"Try it out"** → **"Execute"**

5. Check the response:
   - ✅ **Status 200**: Database connected!
   - ❌ **Status 503**: Connection failed

---

## 🧪 What Each Test Tells You

| Endpoint | What It Tests | Pass Criteria |
|----------|---------------|---------------|
| `/health` | Server is running | Returns `status: "ok"` |
| `/health/database` | Database connection | Returns `database: "connected"` |
| `/health/detailed` | Everything | All components show as healthy |

---

## 🔍 Troubleshooting

### **Issue 1: Server Won't Start**

**Error:**
```
Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
```

**Solution:**
1. Check `/backend/.env` exists
2. Verify `SUPABASE_URL` is set
3. Verify `SUPABASE_SERVICE_ROLE_KEY` is set
4. No extra spaces in values
5. Restart server

---

### **Issue 2: Database Connection Failed**

**Error:**
```json
{
  "status": "error",
  "database": "error",
  "message": "Invalid API key"
}
```

**Solution:**
1. Go to Supabase Dashboard → Settings → API
2. Copy the **service_role** key (NOT anon key!)
3. Update `SUPABASE_SERVICE_ROLE_KEY` in `.env`
4. Restart server

---

### **Issue 3: CORS Errors (when testing from browser)**

**Solution:**

Update `.env`:
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:4200
```

Restart server.

---

### **Issue 4: "Cannot find module 'pg'"**

**Solution:**
```bash
cd backend
npm install pg @supabase/supabase-js
```

---

## 📊 Connection Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  1. Server Starts                                       │
│     npm run start:dev                                   │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  2. Load Environment Variables                          │
│     ConfigModule reads /backend/.env                    │
│     - SUPABASE_URL                                      │
│     - SUPABASE_SERVICE_ROLE_KEY                         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  3. Initialize DatabaseService                          │
│     - Creates Supabase client                           │
│     - Creates PostgreSQL connection pool                │
│     - Tests connection                                  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  4. Connection Status                                   │
│     ✅ Success: "PostgreSQL connection established"     │
│     ❌ Failure: Error message logged                    │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  5. API Ready                                           │
│     http://localhost:3000/api/docs                      │
│     http://localhost:3000/api/v1/health/database        │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Connection Checklist

Before testing:

- [ ] Created `/backend/.env` file
- [ ] Updated `SUPABASE_URL` in `.env`
- [ ] Updated `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- [ ] Updated `JWT_SECRET` in `.env` (64+ characters)
- [ ] Ran `npm install` in `/backend` directory
- [ ] Started server with `npm run start:dev`
- [ ] Saw "PostgreSQL connection established" message
- [ ] Tested `/api/v1/health/database` endpoint
- [ ] Got `"database": "connected"` response

---

## 🎯 Quick Test Commands

Copy-paste these commands:

```bash
# 1. Navigate to backend
cd backend

# 2. Install dependencies
npm install

# 3. Start server (watch for connection messages)
npm run start:dev

# In another terminal:

# 4. Test basic health
curl http://localhost:3000/api/v1/health

# 5. Test database connection
curl http://localhost:3000/api/v1/health/database

# 6. Get detailed status
curl http://localhost:3000/api/v1/health/detailed
```

---

## 🚀 Next Steps After Successful Connection

Once you see `"database": "connected"`:

### **1. Load Seed Data**

```bash
cd backend
npm run seed
```

This will populate:
- ✅ 3 users (Admin, Payroll Officer, Accountant)
- ✅ 5 departments
- ✅ 12 allowances
- ✅ 8 deductions

### **2. Test Authentication**

```bash
# Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@jsc.gov.ng",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admin@jsc.gov.ng",
    "role": "Admin"
  }
}
```

### **3. Test Staff Endpoint**

```bash
# Get all staff (use token from login)
curl http://localhost:3000/api/v1/staff \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### **4. Explore Swagger UI**

Open: http://localhost:3000/api/docs

- Click **"Authorize"** button
- Paste your access token
- Try out different endpoints

---

## 📝 Summary

### **What We Created:**

1. ✅ **Health Module** - 3 endpoints to test connection
2. ✅ **Database Service** - Auto-connects on startup
3. ✅ **Environment Config** - Loads from `.env` file

### **How It Works:**

1. You edit `.env` with Supabase credentials
2. Server starts and reads `.env`
3. DatabaseService connects automatically
4. Health endpoints confirm connection
5. All other endpoints use the connection

### **No Frontend Tools Needed:**

❌ **Not needed:** `supabase_connect` (for frontend)
✅ **Already working:** Environment-based connection (backend)

---

## 🎉 Success Criteria

You know your connection is working when:

1. ✅ Server starts without errors
2. ✅ Logs show: "PostgreSQL connection established"
3. ✅ `/api/v1/health/database` returns `"database": "connected"`
4. ✅ Swagger UI loads at `/api/docs`
5. ✅ You can login and get a JWT token
6. ✅ Protected endpoints work with the token

---

**Your backend is ready to connect! Just start the server and test the health endpoints.** 🚀

No `supabase_connect` needed - your `.env` configuration is all you need!
