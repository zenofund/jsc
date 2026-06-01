# 🔧 JSC-PMS Troubleshooting Guide

## Common Errors and Solutions

---

## Error: "Failed to fetch" / "Failed to load payroll batches"

### Symptoms:
- Frontend shows "Failed to fetch" errors
- Console shows network errors
- Data doesn't load from backend

### Cause:
The backend server is not running or not accessible.

### Solution:

```bash
# Step 1: Navigate to backend folder
cd backend

# Step 2: Check if .env file exists
ls -la | grep .env

# Step 3: If .env doesn't exist, create it
cp .env.example .env
# Edit .env with your Supabase credentials

# Step 4: Install dependencies (if not done)
npm install

# Step 5: Start the backend server
npm run start:dev

# Step 6: Wait for this message:
# "🚀 Server running on: http://localhost:3000"

# Step 7: In another terminal, start frontend
cd ..
npm run dev
```

### Verify Backend is Running:

```bash
# Test health endpoint
curl http://localhost:3000/api/v1/health

# Expected: {"status":"ok","timestamp":"..."}
```

---

## Error: "Backend server is not available"

### Cause:
Backend server is not running on the expected port (3000).

### Solution:

1. **Check if backend is running:**
   ```bash
   lsof -i :3000
   ```

2. **If nothing is running, start backend:**
   ```bash
   cd backend
   npm run start:dev
   ```

3. **If port 3000 is occupied by another process:**
   ```bash
   # Kill the process
   lsof -ti:3000 | xargs kill -9
   
   # Or change the port in backend/.env
   PORT=3001
   
   # Also update frontend API URL in /.env
   VITE_API_URL=http://localhost:3001/api/v1
   ```

---

## Error: "Database connection failed"

### Symptoms:
- Backend starts but shows database errors
- `/api/v1/health/database` returns error

### Solution:

1. **Check Supabase credentials:**
   ```bash
   cd backend
   cat .env | grep SUPABASE
   ```

2. **Verify in Supabase Dashboard:**
   - Go to https://supabase.com
   - Navigate to your project
   - Settings → API
   - Copy correct URL and Service Role Key

3. **Update .env file:**
   ```env
   SUPABASE_URL=https://your-correct-project-id.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-correct-service-role-key
   ```

4. **Restart backend server:**
   ```bash
   npm run start:dev
   ```

5. **Test database connection:**
   ```bash
   curl http://localhost:3000/api/v1/health/database
   ```

---

## Error: "Unauthorized" / "401 Unauthorized"

### Cause:
JWT token is missing or invalid.

### Solution:

1. **Login again** - Navigate to login page and sign in
2. **Check localStorage:**
   - Open browser DevTools (F12)
   - Go to Application → Local Storage
   - Look for `jsc_auth_token`
   - If missing, login again

3. **Clear browser storage and login:**
   ```javascript
   // In browser console
   localStorage.clear();
   sessionStorage.clear();
   // Then refresh and login
   ```

---

## Error: "CORS policy" / "CORS error"

### Symptoms:
- Browser console shows CORS policy error
- Requests are blocked

### Solution:

1. **Update backend CORS configuration:**
   ```bash
   cd backend
   nano .env
   ```

2. **Set CORS_ORIGIN:**
   ```env
   CORS_ORIGIN=http://localhost:5173,http://localhost:3000
   ```

3. **Restart backend:**
   ```bash
   npm run start:dev
   ```

---

## Error: "Cannot find module '@nestjs/...'"

### Cause:
Backend dependencies are not installed.

### Solution:

```bash
cd backend

# Remove old dependencies
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Start server
npm run start:dev
```

---

## Error: "Table does not exist" / "relation does not exist"

### Cause:
Database tables are not created in Supabase.

### Solution:

1. **Go to Supabase Dashboard**
2. **Open SQL Editor**
3. **Copy content from `/database/schema.sql`**
4. **Paste and execute** in SQL Editor
5. **Verify tables are created:**
   - Go to Table Editor
   - Check that all 27 tables exist

---

## Error: "Port 5173 is already in use"

### Cause:
Another instance of the frontend is running.

### Solution:

```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Restart frontend
npm run dev
```

---

## Data Not Loading / Empty Pages

### Symptoms:
- Pages load but show no data
- "No records found"

### Possible Causes & Solutions:

1. **Backend not running:**
   ```bash
   cd backend && npm run start:dev
   ```

2. **No data in database:**
   - Add sample data via the UI
   - Or import sample data via Supabase Dashboard

3. **Wrong API endpoint:**
   - Check browser DevTools → Network tab
   - Verify API calls are going to correct endpoints
   - Should be: `http://localhost:3000/api/v1/...`

4. **Authentication issue:**
   - Logout and login again
   - Check JWT token in localStorage

---

## Backend Starts but Frontend Can't Connect

### Checklist:

1. **Verify backend is running:**
   ```bash
   curl http://localhost:3000/api/v1/health
   ```

2. **Check frontend API URL:**
   ```bash
   cat .env | grep VITE_API_URL
   ```
   Should be: `VITE_API_URL=http://localhost:3000/api/v1`

3. **Restart frontend:**
   ```bash
   npm run dev
   ```

4. **Check browser console** for errors

5. **Verify CORS settings** in backend `.env`

---

## Slow Performance / Timeouts

### Solutions:

1. **Check Supabase connection:**
   - Slow internet connection
   - Supabase region far from your location

2. **Optimize database:**
   - Ensure indexes are created (check schema.sql)
   - Reduce query complexity

3. **Check backend logs:**
   ```bash
   # Backend terminal will show query times
   ```

4. **Increase timeout:**
   - In frontend, increase fetch timeout
   - In backend, increase database connection timeout

---

## Environment Variable Not Loading

### Symptoms:
- `undefined` values in config
- Backend can't find .env values

### Solution:

1. **Verify .env file exists:**
   ```bash
   ls -la backend/.env
   ```

2. **Check .env format:**
   ```env
   # No spaces around =
   PORT=3000  ✅
   PORT = 3000  ❌
   
   # No quotes needed (usually)
   JWT_SECRET=mysecret  ✅
   ```

3. **Restart backend** (changes require restart)

---

## TypeScript Errors in Backend

### Solution:

```bash
cd backend

# Rebuild TypeScript
npm run build

# If errors persist, clean and rebuild
rm -rf dist
npm run build

# Start in dev mode (auto-reloads)
npm run start:dev
```

---

## Frontend Build Errors

### Solution:

```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install

# If using Vite, clear cache
rm -rf .vite

# Rebuild
npm run build
```

---

## Database Query Errors

### Symptoms:
- Backend logs show SQL errors
- "syntax error at or near..."

### Solution:

1. **Check table names** match schema
2. **Verify column names** are correct
3. **Check data types** match schema
4. **Review recent schema changes**

---

## Quick Diagnostic Checklist

Run these commands to diagnose issues:

```bash
# 1. Check backend is running
curl http://localhost:3000/api/v1/health

# 2. Check database connection
curl http://localhost:3000/api/v1/health/database

# 3. Check frontend is running
curl http://localhost:5173

# 4. Check environment variables
cd backend && cat .env

# 5. Check backend logs
cd backend && npm run start:dev
# Look for errors in terminal

# 6. Check frontend console
# Open browser DevTools (F12)
# Look for errors in Console and Network tabs
```

---

## Still Need Help?

### Debug Mode:

1. **Enable verbose logging:**
   ```env
   # In backend/.env
   LOG_LEVEL=debug
   ```

2. **Check all logs:**
   - Backend terminal output
   - Browser console (F12)
   - Network tab in DevTools
   - Supabase logs (Dashboard → Logs)

3. **Test endpoints individually:**
   - Go to http://localhost:3000/api/docs
   - Try each endpoint manually
   - Check request/response

---

## Success Indicators

You know everything is working when:

✅ Backend running: `curl http://localhost:3000/api/v1/health` returns `{"status":"ok"}`  
✅ Database connected: `curl http://localhost:3000/api/v1/health/database` returns success  
✅ Frontend running: Browser opens http://localhost:5173  
✅ No errors in browser console  
✅ No errors in backend terminal  
✅ Data loads on all pages  
✅ Login works  
✅ CRUD operations work  

---

**Last Updated**: December 25, 2024
