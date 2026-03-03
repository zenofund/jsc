# 🚀 JSC-PMS Backend - Quick Start Guide

## ⚡ 5-Minute Setup

### **Step 1: Update .env File** (2 minutes)

```bash
# Open the .env file
cd backend
code .env
# or
nano .env
```

**Replace these 3 values:**

1. **SUPABASE_URL** → Your Supabase project URL
2. **SUPABASE_SERVICE_ROLE_KEY** → Your service_role key (from Supabase Dashboard)
3. **JWT_SECRET** → Generate with: `openssl rand -base64 64`

### **Step 2: Install & Start** (3 minutes)

```bash
cd backend
npm install
npm run start:dev
```

### **Step 3: Verify Connection** (30 seconds)

Open: **http://localhost:3000/api/v1/health/database**

✅ Look for: `"database": "connected"`

---

## 🎯 Quick Test

```bash
# Test health
curl http://localhost:3000/api/v1/health/database

# Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@jsc.gov.ng","password":"password123"}'

# Explore API
open http://localhost:3000/api/docs
```

---

## 📚 Important URLs

| URL | Purpose |
|-----|---------|
| http://localhost:3000/api/docs | Swagger API Documentation |
| http://localhost:3000/api/v1/health | Basic health check |
| http://localhost:3000/api/v1/health/database | Database connection status |
| http://localhost:3000/api/v1/health/detailed | Complete system status |

---

## 🔑 Test Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@jsc.gov.ng | password123 | Admin |
| payroll@jsc.gov.ng | password123 | Payroll Officer |
| accountant@jsc.gov.ng | password123 | Accountant |

---

## ✅ What's Already Done

- ✅ 6 complete modules (Auth, Staff, Departments, Payroll, Allowances, Deductions)
- ✅ 39 API endpoints
- ✅ PostgreSQL schema (15+ tables)
- ✅ Seed data ready
- ✅ Role-based access control
- ✅ Bulk operations for 800+ staff
- ✅ Complete Swagger documentation
- ✅ Health check endpoints

---

## 🚧 What's Next

After connection works:

1. **Load seed data:** `npm run seed`
2. **Test endpoints** via Swagger UI
3. **Build remaining modules:** Leaves, Cooperatives, Loans, Reports
4. **Connect frontend** application

---

## 🔍 Troubleshooting

### Server won't start?
- Check `.env` file exists in `/backend/` directory
- Verify all 3 required values are set

### Database connection failed?
- Use **service_role** key (not anon key!)
- Check Supabase Dashboard → Settings → API
- Verify project URL is correct

### Need help?
- Check `/DATABASE_CONNECTION_TEST.md` for detailed testing
- Check `/ENV_SETUP_GUIDE.md` for .env configuration
- Check `/DOTFILES_ACCESS.md` for accessing hidden files

---

## 💡 Pro Tips

**Tip 1:** Health endpoints are **public** (no auth required)
**Tip 2:** Use Swagger UI for easy API testing
**Tip 3:** Check server logs for connection status messages
**Tip 4:** `.env` file is gitignored (safe from accidental commits)

---

## 📞 Documentation Files

| File | Purpose |
|------|---------|
| `/DOTFILES_ACCESS.md` | How to access .env and other hidden files |
| `/ENV_SETUP_GUIDE.md` | Detailed .env configuration guide |
| `/DATABASE_CONNECTION_TEST.md` | How to test Supabase connection |
| `/STAFF_MODULE_VERIFICATION.md` | Staff module completeness verification |
| `/QUICK_START.md` | This file - quick reference |

---

**You're ready to go! Start the server and test the health endpoint.** 🎉

**No `supabase_connect` tool needed - your backend connects automatically!**
