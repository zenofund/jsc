# Render Deployment Guide - JSC Payroll Management System (Backend)

## ✅ Render Compliance Assessment

The backend is fully prepared for Render deployment.

---

## 🚀 Deployment Steps (Backend API)

### **Step 1: Create Backend Service on Render**

1. Go to [Render.com](https://render.com) and log in.
2. Click **"New +"** → **"Web Service"**.
3. Connect your GitHub repository.
4. Set the following configurations:
    - **Name:** `jsc-pms-backend`
    - **Root Directory:** `backend`
    - **Runtime:** `Node`
    - **Build Command:** `npm install --include=dev && npm run build`
    - **Start Command:** `npm run start:prod`
    - **Instance Type:** `Free` (or higher for production)

### **Step 2: Configure Environment Variables**

Add these in the **"Environment"** tab on Render:

```bash
# === SERVER CONFIGURATION ===
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1

# === DATABASE (NEON) ===
# Use your Neon connection string
DATABASE_URL=postgres://user:password@ep-cool-project-123456.us-east-2.aws.neon.tech/neondb?sslmode=require

# === AUTHENTICATION ===
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=24h

# === CORS (Update with your frontend URL) ===
CORS_ORIGIN=https://your-frontend-domain.com

# === OPTIONAL (SMTP EMAIL) ===
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@jsc.gov.ng
```

### **Step 3: Deploy**

Click **"Create Web Service"**. Render will:
1. Pull the code.
2. Change into the `backend` directory.
3. Run `npm install` and `npm run build`.
4. Start the server using `npm run start:prod`.

**Expected Deployment URL:**  
`https://jsc-pms-backend.onrender.com`

---

## 📋 Post-Deployment Checklist

- [ ] **Verify Health Check:** Visit `https://your-app.onrender.com/api/v1/health`.
- [ ] **Check Swagger Docs:** Visit `https://your-app.onrender.com/api/docs`.
- [ ] **Database Connection:** Verify logs in Render to ensure Neon is connected.
- [ ] **Update Frontend:** Ensure your frontend's `VITE_API_URL` points to the new Render URL.

---

## 🔧 Troubleshooting (Render Specific)

### **1. Deployment Timeouts or "nest: not found"**
If you get `sh: 1: nest: not found`, it's because `NODE_ENV=production` is preventing the installation of `@nestjs/cli`.

**Fix:** Use `npm install --include=dev && npm run build` as the **Build Command**. Render needs the dev dependencies to build the project, even if it runs in production mode.

If the build takes too long on the Free tier, ensure `node_modules` is NOT being uploaded (it shouldn't be via `.gitignore`). Render builds from scratch.

### **2. Port Binding**
Render automatically assigns a port. The backend is already configured to use `process.env.PORT || 3000`, so it will bind correctly.

### **3. Database Connectivity**
If you see "Connection Refused", ensure your Neon database allows connections from all IPs (Render's outbound IPs are dynamic).

---

## 🎯 Recommended Flow

1. **Deploy Backend to Render.**
2. **Copy the Render URL.**
92. 3. **Deploy Frontend** (Vercel, Railway, or Render) using that URL as `VITE_API_URL` (e.g., `https://jsc-pms-backend.onrender.com/api/v1`).
93. 4. **Update CORS_ORIGIN** in Render Backend settings with your actual Frontend URL.

---

## 📞 Support

- **Render Docs:** https://docs.render.com
- **Render Status:** https://status.render.com
- **Neon Docs:** https://neon.tech/docs

Your backend is ready for the judicial service! 🚀
