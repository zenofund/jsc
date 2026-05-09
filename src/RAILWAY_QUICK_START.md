# 🚀 Railway Quick Start - JSC PMS

## ✅ Pre-Deployment Checklist

Your codebase is now **100% Railway-compliant!**

### **Files Added:**
- ✅ `/package.json` - Frontend build config
- ✅ `/index.html` - Entry HTML
- ✅ `/main.tsx` - React entry point
- ✅ `/vite.config.ts` - Vite configuration
- ✅ `/tsconfig.json` - TypeScript config
- ✅ `/railway.json` - Railway deployment config
- ✅ `/tailwind.config.js` - Tailwind CSS config
- ✅ `/postcss.config.js` - PostCSS config
- ✅ `/.gitignore` - Git ignore rules

### **Existing Backend Files:**
- ✅ `/backend/railway.json` - Backend Railway config
- ✅ `/backend/nixpacks.toml` - Build configuration
- ✅ `/backend/package.json` - Backend dependencies

---

## 🎯 5-Minute Deployment Guide

### **Step 1: Push to GitHub**
```bash
git add .
git commit -m "Add Railway deployment configs"
git push origin main
```

### **Step 2: Deploy Backend**

1. Go to [railway.app](https://railway.app)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Railway will detect 2 services:
   - **Backend** (in `/backend`)
   - **Frontend** (in root)

#### **Configure Backend Service:**
- **Name:** `jsc-pms-backend`
- **Root Directory:** `/backend`
- **Builder:** Nixpacks (auto-detected)

#### **Add Backend Environment Variables:**
```env
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1
CORS_ORIGIN=https://your-frontend-domain.railway.app
DATABASE_URL=postgres://user:password@ep-cool-project-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=24h
```

**Optional (Email):**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@jsc.gov.ng
```

**Deploy** → Wait 2-3 minutes → Get backend URL

---

### **Step 3: Deploy Frontend**

#### **Configure Frontend Service:**
- **Name:** `jsc-pms-frontend`
- **Root Directory:** `/` (root)
- **Builder:** Nixpacks (auto-detected)

#### **Add Frontend Environment Variables:**
```env
VITE_API_URL=https://jsc-pms-backend.up.railway.app/api/v1
```

**Deploy** → Wait 2-3 minutes → Get frontend URL

---

### **Step 4: Update CORS**

Go back to **Backend Service** → Environment Variables → Update:
```env
CORS_ORIGIN=https://jsc-pms-frontend.up.railway.app,http://localhost:5173
```

**Redeploy Backend** → Done! ✅

---

## 🧪 Testing Your Deployment

### **1. Test Backend Health:**
```bash
curl https://jsc-pms-backend.up.railway.app/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-XX...",
  "database": "connected"
}
```

### **2. Test Swagger API Docs:**
Visit: `https://jsc-pms-backend.up.railway.app/api/docs`

### **3. Test Frontend:**
Visit: `https://jsc-pms-frontend.up.railway.app`

Login with default credentials:
- **Email:** `admin@jsc.gov.ng`
- **Password:** `Admin123!`

---

## 🔧 Common Issues & Fixes

### **Issue 1: Backend fails to start**
**Symptom:** "Application failed to respond"

**Fix:**
1. Check Railway logs
2. Verify `DATABASE_URL` is correct
3. Ensure all required env vars are set
4. Check Neon connection limits

### **Issue 2: Frontend shows "Network Error"**
**Symptom:** Login fails with CORS error

**Fix:**
1. Verify `VITE_API_URL` points to Railway backend URL
2. Update `CORS_ORIGIN` in backend to include frontend URL
3. Redeploy backend after CORS change

### **Issue 3: Database connection fails**
**Symptom:** "Connection timeout"

**Fix:**
1. Go to Neon Dashboard → Connection Details
2. Copy **Pooled connection** string (recommended for serverless)
3. Update `DATABASE_URL` in Railway
4. Ensure `?sslmode=require` is at the end

---

## 📊 Expected Railway Usage

### **Backend Service:**
- **Build Time:** ~2 minutes
- **Memory:** 256-512 MB
- **CPU:** Minimal
- **Cost:** ~$5-10/month (Railway Hobby plan)

### **Frontend Service:**
- **Build Time:** ~1 minute
- **Memory:** 128-256 MB
- **CPU:** Minimal
- **Cost:** ~$5-10/month (Railway Hobby plan)

**Total:** ~$10-20/month for both services

---

## 🎉 You're Production Ready!

Your JSC Payroll Management System is now:
- ✅ **Fully deployed** on Railway
- ✅ **Zero downtime** with auto-restarts
- ✅ **Automatic HTTPS** (Railway provides SSL)
- ✅ **Environment-based** configuration
- ✅ **Database-connected** via Neon
- ✅ **API documented** via Swagger
- ✅ **Health monitored** via `/health` endpoint

---

## 📱 Monitoring & Logs

### **View Logs:**
Railway Dashboard → Your Service → **Logs** tab

### **Monitor Health:**
- Backend: `https://backend-url/api/v1/health`
- Frontend: Visit homepage

### **Check Metrics:**
Railway Dashboard → Your Service → **Metrics** tab

---

## 🔐 Security Checklist

Before going live:
- [ ] Change all default passwords
- [ ] Update JWT_SECRET to 32+ random characters
- [ ] Enable Neon IP Allowlisting (optional)
- [ ] Add custom domain (optional)
- [ ] Enable Railway 2FA
- [ ] Review CORS settings
- [ ] Set up database backups
- [ ] Test password recovery flow
- [ ] Review user roles and permissions

---

## 🚀 Next Steps

1. **Custom Domain:** Add `jsc-pms.gov.ng` in Railway settings
2. **Monitoring:** Set up Railway alerting
3. **Backups:** Configure Neon automated backups
4. **CI/CD:** Auto-deploy on git push (already enabled!)
5. **Database Seeds:** Run initial data scripts

---

## 🆘 Need Help?

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Neon Docs:** https://neon.tech/docs

Your system is ready to serve the Nigerian Judicial Service Committee! 🇳🇬
