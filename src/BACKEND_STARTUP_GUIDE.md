# 🚀 JSC-PMS Backend Startup Guide

## ⚠️ Important: Backend Server Required

Your JSC-PMS application now uses **live backend APIs** for most features. If you see errors like:

```
Failed to fetch
Backend server is not available
```

This means the **backend server is not running**. Follow this guide to start it.

---

## 📋 Prerequisites

Before starting the backend server, ensure you have:

1. ✅ **Node.js** installed (v16 or higher)
2. ✅ **npm** or **yarn** package manager
3. ✅ **Supabase account** with a PostgreSQL database
4. ✅ **Environment variables** configured

---

## 🔧 Step 1: Install Backend Dependencies

```bash
# Navigate to backend folder
cd backend

# Install all dependencies
npm install

# Or if you use yarn
yarn install
```

---

## 🔐 Step 2: Configure Environment Variables

Create a `.env` file in the `/backend` directory:

```bash
# In /backend directory
touch .env
```

Add the following environment variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
API_PREFIX=api/v1

# CORS Configuration (Frontend URL)
CORS_ORIGIN=http://localhost:5173

# Supabase Database Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# JWT Secret (for authentication)
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRATION=7d
```

### How to Get Supabase Credentials:

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your project
4. Click **Settings** → **API**
5. Copy:
   - **Project URL** → Use as `SUPABASE_URL`
   - **Service Role Key** (secret) → Use as `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Never commit the `.env` file to git!** It's already in `.gitignore`.

---

## 🗄️ Step 3: Set Up Database Tables

Your Supabase database needs the following tables. Run the schema file:

```bash
# From the root directory
# Copy the content of /database/schema.sql
# Go to Supabase Dashboard → SQL Editor
# Paste the schema and execute
```

**Required Tables** (23 total):
- users
- departments
- staff
- salary_structures
- allowances
- deductions
- staff_allowances
- staff_deductions
- payroll_batches
- payroll_lines
- workflow_approvals
- arrears
- promotions
- leave_types
- leave_balances
- leave_requests
- cooperatives
- cooperative_members
- cooperative_contributions
- loan_types
- loan_applications
- loan_disbursements
- loan_repayments
- loan_guarantors
- notifications
- audit_trail
- custom_reports

---

## ✅ Step 4: Start the Backend Server

```bash
# In /backend directory
npm run start:dev

# Or for production
npm run build
npm run start:prod
```

### Expected Output:

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   JSC Payroll Management System - Backend API            ║
║                                                           ║
║   🚀 Server running on: http://localhost:3000             ║
║   📚 API Documentation: http://localhost:3000/api/docs    ║
║   🌍 Environment: development                             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 🧪 Step 5: Test the Backend

### Test 1: Health Check

```bash
curl http://localhost:3000/api/v1/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-25T10:30:00.000Z"
}
```

### Test 2: Database Connection

```bash
curl http://localhost:3000/api/v1/health/database
```

**Expected Response:**
```json
{
  "database": "connected",
  "message": "PostgreSQL connection successful"
}
```

### Test 3: API Documentation

Open in browser:
```
http://localhost:3000/api/docs
```

You should see Swagger UI with all 107 API endpoints documented.

---

## 🔄 Step 6: Start the Frontend

Now that the backend is running, start your frontend:

```bash
# In a NEW terminal (keep backend running in the other terminal)
# Navigate to root directory
npm run dev

# Or
yarn dev
```

Visit: **http://localhost:5173**

---

## 📊 Verify Integration

1. **Login to the application**
2. **Navigate to any page** (Staff, Payroll Setup, etc.)
3. **Check the browser console** - No "Failed to fetch" errors
4. **Check the backend terminal** - You should see API requests logged

---

## 🐛 Troubleshooting

### Error: "Cannot find module"

**Solution:**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Error: "Port 3000 is already in use"

**Solution:**
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Or change the port in .env
PORT=3001
```

### Error: "Database connection failed"

**Solution:**
1. Check your Supabase URL and Service Role Key
2. Ensure your Supabase project is running
3. Check database connection limits
4. Verify firewall/network settings

### Error: "Unauthorized" on API calls

**Solution:**
1. Login to the frontend application
2. Check that JWT token is stored in `localStorage`
3. Verify `JWT_SECRET` is the same in backend `.env`

### Error: "CORS policy"

**Solution:**
Update `CORS_ORIGIN` in backend `.env`:
```env
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

---

## 📝 Backend Running Checklist

Before using the app, ensure:

- [ ] Backend server is running on `http://localhost:3000`
- [ ] Database health check passes
- [ ] Frontend can connect to backend
- [ ] No CORS errors in browser console
- [ ] JWT authentication is working
- [ ] API endpoints return data (not 404)

---

## 🎯 Quick Start (TL;DR)

```bash
# 1. Set up environment
cd backend
cp .env.example .env
# Edit .env with your Supabase credentials

# 2. Install dependencies
npm install

# 3. Start backend
npm run start:dev

# 4. In another terminal, start frontend
cd ..
npm run dev

# 5. Visit http://localhost:5173
```

---

## 📚 Additional Resources

- **API Documentation**: http://localhost:3000/api/docs
- **Backend Modules**: See `/backend/MODULE_SUMMARY.md`
- **API Endpoints**: See `/backend/API_ENDPOINTS.md`
- **Database Schema**: See `/database/schema.sql`
- **Migration Guide**: See `/SYSTEM_MIGRATION_STATUS.md`

---

## 🆘 Still Having Issues?

1. **Check backend terminal** for error logs
2. **Check browser console** for frontend errors
3. **Verify all environment variables** are set correctly
4. **Ensure Supabase database** has all tables
5. **Test each endpoint** individually via Swagger UI

---

## ✅ Success!

If you see:
- ✅ Backend server running on port 3000
- ✅ Frontend running on port 5173
- ✅ No "Failed to fetch" errors
- ✅ Data loading from database

**You're all set! Your JSC-PMS is now running with live backend APIs!** 🎉

---

**Last Updated**: December 25, 2024
