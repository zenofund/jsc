# 📄 Accessing Hidden Files (.env, .gitignore, etc.)

## Quick Answer

**Your `.env` file is located at:**
```
/backend/.env
```

**To access it directly (recommended):**

```bash
# Using your terminal/command line
cd backend
nano .env        # Linux/Mac
notepad .env     # Windows
code .env        # VS Code
```

---

## 🔍 All Dotfiles Created

```
backend/
├── .env              # Your actual configuration (SECRET!)
├── .env.example      # Template (safe to share)
└── .gitignore        # Git exclusion rules
```

---

## 📝 What You Need to Update in .env

Open `/backend/.env` and replace these 3 values:

### 1️⃣ Supabase URL
```env
SUPABASE_URL=https://your-project-id.supabase.co
```

**Where to find it:**
- Go to: https://supabase.com/dashboard
- Select your project
- Settings → API → Project URL

### 2️⃣ Supabase Service Role Key
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to find it:**
- Same page (Settings → API)
- Look for: **service_role** key (NOT anon key!)
- Click "Copy" button
- ⚠️ Keep this SECRET! Never commit to Git!

### 3️⃣ JWT Secret (Generate a Random String)
```env
JWT_SECRET=your-super-secure-jwt-secret-change-this-in-production
```

**How to generate:**

**Option A: Using OpenSSL (Linux/Mac/Git Bash)**
```bash
openssl rand -base64 64
```

**Option B: Using PowerShell (Windows)**
```powershell
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Option C: Using Online Generator**
- Go to: https://www.random.org/strings/
- Generate 1 string, 64 characters
- Use: Alphanumeric

---

## ✅ Verification Steps

### Step 1: Check if .env exists
```bash
cd backend
ls -la | grep .env
# Should show: .env, .env.example
```

### Step 2: Verify .env is loaded
```bash
cd backend
npm run start:dev
```

**Success looks like:**
```
╔═══════════════════════════════════════════════════════════╗
║   JSC Payroll Management System - Backend API            ║
║   🚀 Server running on: http://localhost:3000             ║
║   📚 API Documentation: http://localhost:3000/api/docs    ║
║   🌍 Environment: development                             ║
╚═══════════════════════════════════════════════════════════╝
```

### Step 3: Test API
Open browser: http://localhost:3000/api/docs

**If you see Swagger UI, you're all set!** ✅

---

## 🚨 Troubleshooting

### Issue: "Cannot find .env file"

**Solution:**
```bash
cd backend
cp .env.example .env
# Then edit .env with your values
```

### Issue: "ConfigModule error"

**Solution:**
```bash
cd backend
npm install @nestjs/config
```

### Issue: Environment variables are undefined

**Check:**
1. ✅ File is named `.env` (not `env.txt` or `.env.txt`)
2. ✅ File is in `/backend/` directory (not `/backend/src/`)
3. ✅ No extra spaces in variable values
4. ✅ Restart server after editing .env

---

## 🔐 Security Reminders

**NEVER commit .env to Git!**

✅ **Safe to commit:**
- `.env.example`
- `.gitignore`
- Any other dotfiles (except .env)

❌ **NEVER commit:**
- `.env`
- `.env.local`
- Any file with actual credentials

**Check before committing:**
```bash
git status
# Make sure .env is NOT listed!
```

---

## 📋 Complete .env Template

Here's your `/backend/.env` after configuration:

```env
# APPLICATION
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# SUPABASE (Replace with your actual values)
SUPABASE_URL=https://abcdefghijk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTYxNjE2MTYxNiwiZXhwIjoxOTMxNzM3NjE2fQ.your-signature-here

# JWT (Generate a random 64-character string)
JWT_SECRET=kL8mN9pQ2rS5tU7vW0xY3zA6bC1dE4fG7hI0jK3lM6nO9pQ2rS5tU7vW0xY3zA6b
JWT_EXPIRATION=24h

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# LOGGING
LOG_LEVEL=log

# SECURITY
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
ENABLE_REQUEST_LOGGING=true
```

---

## 🎯 Quick Start Checklist

- [ ] Created `.env` file in `/backend/` directory
- [ ] Updated `SUPABASE_URL` with your project URL
- [ ] Updated `SUPABASE_SERVICE_ROLE_KEY` with your service role key
- [ ] Generated and set `JWT_SECRET` (64+ characters)
- [ ] Verified `.env` is in `.gitignore`
- [ ] Started backend: `npm run start:dev`
- [ ] Tested API at http://localhost:3000/api/docs
- [ ] Successfully logged in with test credentials

---

**Your `.env` file is ready! Update the 3 values above and start the server.** 🚀

See [ENV_SETUP_GUIDE.md](./ENV_SETUP_GUIDE.md) for detailed instructions.
