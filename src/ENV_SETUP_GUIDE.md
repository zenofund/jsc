# 🔐 Environment Variables Setup Guide

## Problem: Can't See .env File?

Dotfiles (files starting with `.`) are hidden by default in most file explorers and IDEs.

---

## 📍 Location

The `.env` file is located at:
```
/backend/.env
```

---

## ✅ How to Access .env Files

### **Method 1: Direct Path (Recommended)**

In your code editor or terminal, open the file directly using its full path:

```bash
# Using VS Code
code backend/.env

# Using nano (Linux/Mac)
nano backend/.env

# Using vim (Linux/Mac)
vim backend/.env

# Using notepad (Windows)
notepad backend\.env
```

### **Method 2: Show Hidden Files**

**VS Code:**
1. Open Settings (Ctrl/Cmd + ,)
2. Search for "exclude"
3. Remove `.env` from excluded patterns

**macOS Finder:**
```bash
# Press: Cmd + Shift + . (period)
```

**Windows Explorer:**
1. View tab → Show → Hidden items

**Linux Terminal:**
```bash
ls -la backend/
```

---

## 🚀 Quick Setup (Copy-Paste Ready)

### **Step 1: Get Your Supabase Credentials**

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to: **Settings → API**
4. Copy:
   - **Project URL** (e.g., `https://abcdefg.supabase.co`)
   - **Service Role Key** (secret - starts with `eyJhbGci...`)

### **Step 2: Update Your .env File**

Open `/backend/.env` and replace these values:

```env
# Replace with your actual Supabase URL
SUPABASE_URL=https://your-project-id.supabase.co

# Replace with your actual Service Role Key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-actual-service-role-key-here

# Generate a secure JWT secret (or use the command below)
JWT_SECRET=your-super-secure-jwt-secret-change-this-in-production
```

### **Step 3: Generate Secure JWT Secret (Recommended)**

Run this command to generate a secure random string:

```bash
# On Linux/Mac
openssl rand -base64 64

# On Windows (PowerShell)
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Or use online generator
# https://www.random.org/strings/
```

Copy the output and paste it as your `JWT_SECRET`.

---

## 📋 Complete .env Template

Here's what your `.env` should look like after configuration:

```env
# =====================================================
# APPLICATION
# =====================================================
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# =====================================================
# SUPABASE DATABASE
# =====================================================
SUPABASE_URL=https://abcdefghijk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTYxNjE2MTYxNiwiZXhwIjoxOTMxNzM3NjE2fQ.your-actual-signature-here

# =====================================================
# JWT AUTHENTICATION
# =====================================================
JWT_SECRET=kL8mN9pQ2rS5tU7vW0xY3zA6bC1dE4fG7hI0jK3lM6nO9pQ2rS5tU7vW0xY3zA6b
JWT_EXPIRATION=24h

# =====================================================
# CORS
# =====================================================
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# =====================================================
# LOGGING
# =====================================================
LOG_LEVEL=log

# =====================================================
# SECURITY
# =====================================================
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
ENABLE_REQUEST_LOGGING=true
```

---

## 🧪 Verify Your Configuration

### **Step 1: Check if .env is loaded**

Create a test file: `backend/test-env.js`

```javascript
require('dotenv').config();

console.log('Environment Variables Check:');
console.log('✅ PORT:', process.env.PORT);
console.log('✅ SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing');
console.log('✅ SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing');
console.log('✅ JWT_SECRET:', process.env.JWT_SECRET ? '✓ Set' : '✗ Missing');
```

Run:
```bash
cd backend
node test-env.js
```

Expected output:
```
Environment Variables Check:
✅ PORT: 3000
✅ SUPABASE_URL: ✓ Set
✅ SUPABASE_SERVICE_ROLE_KEY: ✓ Set
✅ JWT_SECRET: ✓ Set
```

### **Step 2: Start the Backend**

```bash
cd backend
npm run start:dev
```

If you see:
```
[Nest] 12345  - 01/15/2025, 10:00:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 01/15/2025, 10:00:00 AM     LOG [InstanceLoader] DatabaseModule dependencies initialized
```

✅ **Your .env is configured correctly!**

---

## ⚠️ Common Issues

### **Issue 1: "Cannot find module 'dotenv'"**

```bash
cd backend
npm install dotenv
```

### **Issue 2: Environment variables are undefined**

**Solution:**
1. Make sure `.env` file is in `/backend/` directory
2. Check that `main.ts` has: `require('dotenv').config();` at the top
3. Restart the server after changing `.env`

### **Issue 3: Supabase connection error**

**Error:**
```
Failed to connect to database: Invalid API key
```

**Solution:**
- Double-check your `SUPABASE_SERVICE_ROLE_KEY` (not the anon key!)
- Make sure there are no extra spaces
- Verify the key in Supabase Dashboard → Settings → API

### **Issue 4: JWT authentication failing**

**Error:**
```
401 Unauthorized
```

**Solution:**
- Make sure `JWT_SECRET` is set
- Must be at least 32 characters
- Restart the server after changing

---

## 🔒 Security Checklist

Before deploying to production:

- [ ] ✅ `.env` is in `.gitignore`
- [ ] ✅ Never commit `.env` to Git
- [ ] ✅ Use strong JWT_SECRET (64+ characters)
- [ ] ✅ Keep SUPABASE_SERVICE_ROLE_KEY secret
- [ ] ✅ Change NODE_ENV to `production`
- [ ] ✅ Update CORS_ORIGINS to your actual frontend URL
- [ ] ✅ Use environment variables in hosting platform (not .env file)

---

## 📦 Files Created

```
backend/
├── .env                 # Your actual config (NEVER commit!)
├── .env.example         # Template (safe to commit)
└── .gitignore          # Ensures .env is never committed
```

---

## 🚀 Next Steps

1. ✅ Update `.env` with your Supabase credentials
2. ✅ Generate secure JWT_SECRET
3. ✅ Run `npm run start:dev` in backend directory
4. ✅ Test API at http://localhost:3000/api/docs
5. ✅ Login with: `admin@jsc.gov.ng` / `password123`

---

## 💡 Pro Tips

**Tip 1: Use dotenv-cli for testing**
```bash
npm install -g dotenv-cli
dotenv -e .env.test npm run start:dev
```

**Tip 2: Validate .env on startup**
```typescript
// backend/src/main.ts
async function bootstrap() {
  // Validate required env vars
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  
  // ... rest of bootstrap
}
```

**Tip 3: Different .env for different environments**
```bash
.env.development
.env.staging
.env.production
```

---

## 📞 Need Help?

If you still can't access the `.env` file:

1. Check you're in the `/backend` directory
2. Try: `ls -la` (Linux/Mac) or `dir /a` (Windows)
3. Look for `.env` in the output
4. If missing, copy from `.env.example`:
   ```bash
   cp .env.example .env
   ```

---

**Your `.env` file is ready at: `/backend/.env`** ✅

Just update the Supabase credentials and you're good to go! 🚀
