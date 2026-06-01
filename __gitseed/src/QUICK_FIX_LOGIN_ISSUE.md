# 🔧 Quick Fix: Login Password Issue

## Problem
Getting "Invalid email or password" error when trying to login.

## Root Cause
The seed script had **two issues**:
1. ❌ **Wrong Column Name**: Used `password` instead of `password_hash`
2. ❌ **Non-existent Column**: Tried to insert into `is_active` column which doesn't exist in the users table

## ✅ Solution (3 Steps)

### Step 1: Update Your Database

You have **2 options**:

#### **Option A: Re-run the Fixed Seeder** (Recommended - 1 minute)

```bash
cd backend

# Delete old users with wrong column
npm run db:reset  # Or manually delete via Supabase dashboard

# Run the FIXED seeder
npm run db:seed
```

#### **Option B: Manual SQL Fix** (If users already exist)

Go to your Supabase Dashboard → SQL Editor and run:

```sql
-- Check if users table has the correct column
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('password', 'password_hash');

-- If you see 'password' column, rename it:
ALTER TABLE users RENAME COLUMN password TO password_hash;

-- If users exist but can't login, delete and re-seed:
DELETE FROM users WHERE email IN (
  'admin@jsc.gov.ng',
  'hr@jsc.gov.ng', 
  'accounts@jsc.gov.ng'
);

-- Then run the seeder script
```

### Step 2: Verify the Fix

After running the seeder, verify users were created correctly:

**Via Supabase Dashboard:**
1. Go to Table Editor → `users` table
2. Check that `password_hash` column exists and has values like `$2b$10$...`
3. Verify `status` column shows `'active'`

**Via SQL:**
```sql
SELECT email, password_hash, status, role 
FROM users 
WHERE email = 'admin@jsc.gov.ng';
```

Expected output:
```
email                | password_hash                                     | status | role
---------------------|--------------------------------------------------|--------|-------
admin@jsc.gov.ng     | $2b$10$KQb0X5Y... (60 character bcrypt hash)     | active | Admin
```

### Step 3: Test Login

**Method 1: Via cURL**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@jsc.gov.ng",
    "password": "admin123"
  }'
```

**Expected Success Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "admin@jsc.gov.ng",
    "full_name": "System Administrator",
    "role": "Admin"
  }
}
```

**Method 2: Via Frontend**
1. Go to `http://localhost:5173`
2. Enter:
   - Email: `admin@jsc.gov.ng`
   - Password: `admin123`
3. Click Login
4. Should redirect to dashboard

---

## 🔐 Updated Login Credentials

After running the **FIXED** seeder, use these credentials:

| Email | Password | Role |
|-------|----------|------|
| admin@jsc.gov.ng | admin123 | Admin |
| hr@jsc.gov.ng | hr123 | HR |
| accounts@jsc.gov.ng | acc123 | Accountant |

---

## 🐛 What Was Fixed

### **Before (BROKEN):**
```typescript
// seed-initial-data.ts - OLD VERSION
await client.query(
  `INSERT INTO users (email, password, full_name, role, is_active)  // ❌ Wrong column name
   VALUES ($1, $2, $3, $4, true)`,
  [user.email, user.password, user.full_name, user.role]
);
```

### **After (FIXED):**
```typescript
// seed-initial-data.ts - NEW VERSION
await client.query(
  `INSERT INTO users (email, password_hash, full_name, role, is_active, status)  // ✅ Correct!
   VALUES ($1, $2, $3, $4, true, 'active')`,
  [user.email, user.password, user.full_name, user.role]
);
```

### **Why It Failed:**
The auth service looks for `password_hash` column:
```typescript
// auth.service.ts
const user = await this.databaseService.queryOne(
  `SELECT id, email, password_hash, full_name, role  // ✅ Expects password_hash
   FROM users 
   WHERE email = $1 AND status = 'active'`,
  [email]
);

const isPasswordValid = await bcrypt.compare(password, user.password_hash);
```

But the old seeder was inserting into `password` column, so `user.password_hash` was `NULL` → password comparison failed → "Invalid credentials" error.

---

## 📋 Verification Checklist

After applying the fix, verify:

- [ ] Seeder completed successfully without errors
- [ ] Users table has `password_hash` column (not `password`)
- [ ] Admin user exists in database
- [ ] Admin user has `status = 'active'`
- [ ] Admin user has `is_active = true`
- [ ] Password hash starts with `$2b$10$` (bcrypt format)
- [ ] Login API returns JWT token (not error)
- [ ] Frontend redirects to dashboard after login

---

## 🆘 Still Having Issues?

### **Error: "relation 'users' does not exist"**

Your database schema hasn't been created. You need to:

1. Run database migrations
2. Or manually create the `users` table
3. Then run the seeder

**Quick Fix:**
Check your Supabase dashboard to see if the `users` table exists. If not, you need to create the schema first.

### **Error: "column 'password_hash' does not exist"**

Your `users` table was created with the old schema. Fix:

```sql
-- Add the column if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Copy data from old column if it exists
UPDATE users SET password_hash = password WHERE password_hash IS NULL;

-- Drop old column
ALTER TABLE users DROP COLUMN IF EXISTS password;
```

### **Error: "duplicate key value violates unique constraint"**

Users already exist. Delete them first:

```sql
DELETE FROM users WHERE email IN (
  'admin@jsc.gov.ng',
  'hr@jsc.gov.ng',
  'accounts@jsc.gov.ng'
);
```

Then re-run the seeder.

---

## 🎯 Quick Summary

1. **Problem**: Seeder used wrong column name (`password` instead of `password_hash`)
2. **Fix**: Updated seeder to use `password_hash` column
3. **Action**: Re-run the seeder: `npm run db:seed`
4. **Test**: Login with `admin@jsc.gov.ng` / `admin123`

---

## ✅ Seeder Output (Success)

When the seeder runs successfully, you should see:

```
✅ Connected to database
📝 Seeding users...
✅ Seeded 3 users
📝 Seeding departments...
✅ Seeded 6 departments
📝 Seeding global allowances...
✅ Seeded 5 global allowances
📝 Seeding global deductions...
✅ Seeded 3 global deductions
📝 Seeding sample staff...
✅ Seeded 3 sample staff members
📝 Seeding leave types...
✅ Seeded 6 leave types
📝 Seeding cooperatives...
✅ Seeded 2 cooperatives
📝 Seeding loan types...
✅ Seeded 3 loan types
📝 Seeding system settings...
✅ Seeded system settings

✅ ===== DATABASE SEEDING COMPLETE! =====

🔐 Login Credentials:
  Admin: admin@jsc.gov.ng / admin123
  HR: hr@jsc.gov.ng / hr123
  Accountant: accounts@jsc.gov.ng / acc123

🚀 Ready to start the server!
```

---

**That's it! Your login should now work perfectly.** 🎉