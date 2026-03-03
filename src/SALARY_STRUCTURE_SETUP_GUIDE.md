# 🚀 Salary Structure Setup Guide

## Overview

This guide will help you set up the salary structure in your JSC Payroll Management System database so that the automatic salary calculation works correctly.

---

## ⚠️ Prerequisites

Before proceeding, ensure you have:

1. ✅ Backend server running (`cd backend && npm run start:dev`)
2. ✅ Database connection configured in `backend/.env`
3. ✅ PostgreSQL database accessible
4. ✅ Node.js and npm installed

---

## 🎯 Quick Setup (Recommended)

### **Option 1: Run the Automated Seeder** (1 minute)

This is the fastest and easiest way to set up the salary structure.

```bash
# From the project root directory
cd backend
npm run db:seed-salary
```

**What this does:**
- ✅ Creates the `salary_structures` table (if it doesn't exist)
- ✅ Creates CONMESS 2024 salary structure
- ✅ 17 grade levels (GL1 - GL17)
- ✅ 5 steps per grade level
- ✅ Realistic salary ranges: ₦80,000 - ₦1,985,000
- ✅ Sets the structure as active

**Expected Output:**
```
✅ Connected to database
✅ Created new salary structure:
   ID: [uuid]
   Name: CONMESS 2024
   Code: CONMESS-2024
   Grade Levels: 17
   Status: active

📊 Salary Structure Summary:
   Name: CONMESS 2024
   Code: CONMESS-2024
   Status: active
   Grade Levels: 17 (GL1 - GL17)
   Steps per level: 5
   Salary range: ₦80,000 - ₦1,985,000

💰 Sample Salaries:
   GL7 Step 1: ₦260,000
   GL8 Step 1: ₦320,000
   GL10 Step 1: ₦500,000
   GL12 Step 1: ₦750,000

✅ Salary structure seeding completed successfully!
```

---

## 🔧 Manual Setup

### **Option 2: Create Via API** (5 minutes)

If you prefer to create the salary structure manually or customize it:

#### **Step 1: Get Your Auth Token**

Login to get your authentication token:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@jsc.gov.ng",
    "password": "your_password"
  }'
```

Copy the `access_token` from the response.

#### **Step 2: Create Salary Structure**

```bash
curl -X POST http://localhost:3000/api/v1/salary-structures \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "CONMESS 2024",
    "code": "CONMESS-2024",
    "effective_date": "2024-01-01",
    "description": "Consolidated Medical Salary Structure 2024",
    "status": "active",
    "grade_levels": [
      {
        "level": 7,
        "steps": [
          { "step": 1, "basic_salary": 260000 },
          { "step": 2, "basic_salary": 270000 },
          { "step": 3, "basic_salary": 280000 }
        ]
      },
      {
        "level": 8,
        "steps": [
          { "step": 1, "basic_salary": 320000 },
          { "step": 2, "basic_salary": 335000 },
          { "step": 3, "basic_salary": 350000 }
        ]
      }
    ]
  }'
```

**Note:** This is a simplified example. For the complete structure with all 17 grade levels, use the seeder script (Option 1).

---

## ✅ Verification

### **Step 1: Test API Endpoint**

Verify the salary structure was created successfully:

```bash
# Get active salary structure
curl -X GET http://localhost:3000/api/v1/salary-structures/active \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "id": "uuid-here",
  "name": "CONMESS 2024",
  "code": "CONMESS-2024",
  "effective_date": "2024-01-01",
  "status": "active",
  "grade_levels": [
    {
      "level": 7,
      "steps": [
        { "step": 1, "basic_salary": 260000 },
        { "step": 2, "basic_salary": 270000 }
      ]
    }
  ]
}
```

### **Step 2: Test Salary Lookup**

Get salary for a specific grade/step:

```bash
# Get salary for Grade 7 Step 1
curl -X GET http://localhost:3000/api/v1/salary-structures/[STRUCTURE_ID]/salary/7/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "gradeLevel": 7,
  "step": 1,
  "basicSalary": 260000,
  "structureName": "CONMESS 2024",
  "structureCode": "CONMESS-2024"
}
```

### **Step 3: Test Frontend Integration**

1. **Open the application** in your browser
2. **Navigate to Staff Management** → Add New Staff
3. **Go to Step 4** (Salary & Bank)
4. **Check for the info banner:**
   - Should say "Automatic Salary Calculation"
   - Should explain salary is auto-fetched

5. **Try creating a promotion:**
   - Open any staff record
   - Click promote
   - Select a new grade/step
   - **Verify:** Salary displays automatically (not an input field)
   - **Verify:** Loading spinner appears briefly
   - **Verify:** Salary amount displays in read-only format

---

## 📊 Salary Structure Details

### **CONMESS 2024 Structure**

The default seeded structure includes:

| Grade Level | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 |
|-------------|--------|--------|--------|--------|--------|
| **GL1** | ₦80,000 | ₦85,000 | ₦90,000 | ₦95,000 | ₦100,000 |
| **GL2** | ₦105,000 | ₦110,000 | ₦115,000 | ₦120,000 | ₦125,000 |
| **GL3** | ₦130,000 | ₦135,000 | ₦140,000 | ₦145,000 | ₦150,000 |
| **GL4** | ₦155,000 | ₦160,000 | ₦165,000 | ₦170,000 | ₦175,000 |
| **GL5** | ₦180,000 | ₦185,000 | ₦190,000 | ₦195,000 | ₦200,000 |
| **GL6** | ₦210,000 | ₦220,000 | ₦230,000 | ₦240,000 | ₦250,000 |
| **GL7** | ₦260,000 | ₦270,000 | ₦280,000 | ₦290,000 | ₦300,000 |
| **GL8** | ₦320,000 | ₦335,000 | ₦350,000 | ₦365,000 | ₦380,000 |
| **GL9** | ₦400,000 | ₦420,000 | ₦440,000 | ₦460,000 | ₦480,000 |
| **GL10** | ₦500,000 | ₦525,000 | ₦550,000 | ₦575,000 | ₦600,000 |
| **GL11** | ₦625,000 | ₦650,000 | ₦675,000 | ₦700,000 | ₦725,000 |
| **GL12** | ₦750,000 | ₦780,000 | ₦810,000 | ₦840,000 | ₦870,000 |
| **GL13** | ₦900,000 | ₦935,000 | ₦970,000 | ₦1,005,000 | ₦1,040,000 |
| **GL14** | ₦1,075,000 | ₦1,115,000 | ₦1,155,000 | ₦1,195,000 | ₦1,235,000 |
| **GL15** | ₦1,280,000 | ₦1,325,000 | ₦1,370,000 | ₦1,415,000 | ₦1,460,000 |
| **GL16** | ₦1,510,000 | ₦1,560,000 | ₦1,610,000 | ₦1,660,000 | ₦1,710,000 |
| **GL17** | ₦1,765,000 | ₦1,820,000 | ₦1,875,000 | ₦1,930,000 | ₦1,985,000 |

---

## 🔄 Updating Salary Structure

### **Option 1: Update via API**

```bash
curl -X PATCH http://localhost:3000/api/v1/salary-structures/[STRUCTURE_ID] \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "grade_levels": [
      {
        "level": 7,
        "steps": [
          { "step": 1, "basic_salary": 280000 },
          { "step": 2, "basic_salary": 290000 }
        ]
      }
    ]
  }'
```

### **Option 2: Update via Database**

```sql
UPDATE salary_structures
SET grade_levels = '[your updated JSON here]',
    updated_at = NOW()
WHERE code = 'CONMESS-2024';
```

**⚠️ Important:** After updating the salary structure, all staff at that grade/step will automatically get the new salary in the next payroll run. No need to update individual staff records!

---

## 🐛 Troubleshooting

### **Problem 1: "No active salary structure found"**

**Symptom:** Error when creating staff or running payroll

**Solution:**
```bash
# Check if structure exists
cd backend
npm run db:seed-salary

# Or activate existing structure via SQL
psql -d your_database -c "UPDATE salary_structures SET status = 'active' WHERE code = 'CONMESS-2024';"
```

### **Problem 2: "Grade level X not found in salary structure"**

**Symptom:** Error when selecting grade/step in promotion modal

**Solution:** The grade level doesn't exist in your salary structure. Either:
1. Run the seeder to get all 17 grade levels: `npm run db:seed-salary`
2. Add the missing grade level via API
3. Update the salary structure JSON to include that grade

### **Problem 3: Frontend shows "Loading..." forever**

**Symptom:** Salary field stuck on "Loading..." in promotion modal

**Possible Causes:**
1. Backend not running - Check `http://localhost:3000/api/v1/health`
2. No active salary structure - Run `npm run db:seed-salary`
3. Network error - Check browser console for errors
4. Invalid auth token - Re-login to get fresh token

**Solution:**
```bash
# 1. Verify backend is running
curl http://localhost:3000/api/v1/health

# 2. Verify salary structure exists
curl http://localhost:3000/api/v1/salary-structures/active \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Check browser console for errors
# Open DevTools (F12) → Console tab
```

### **Problem 4: Database table doesn't exist**

**Symptom:** Error: `relation "salary_structures" does not exist`

**Solution:** The seeder script will automatically create the table:
```bash
cd backend
npm run db:seed-salary
```

Or create it manually:
```sql
CREATE TABLE IF NOT EXISTS salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) UNIQUE NOT NULL,
  effective_date DATE NOT NULL,
  description TEXT,
  grade_levels JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📝 Database Schema

### **salary_structures Table**

```sql
CREATE TABLE salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) UNIQUE NOT NULL,
  effective_date DATE NOT NULL,
  description TEXT,
  grade_levels JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **grade_levels JSONB Format**

```json
[
  {
    "level": 7,
    "steps": [
      { "step": 1, "basic_salary": 260000 },
      { "step": 2, "basic_salary": 270000 },
      { "step": 3, "basic_salary": 280000 }
    ]
  }
]
```

---

## 🔐 Security Notes

1. **Access Control:** Only Admin and Payroll/HR Manager can create/update salary structures
2. **Audit Trail:** All changes are logged with timestamps and user IDs
3. **Validation:** Backend validates all grade/step combinations before accepting
4. **Single Active Structure:** Only one structure can be active at a time

---

## 🎓 Best Practices

1. **Version Control:** Use meaningful codes like "CONMESS-2024", "CONMESS-2025"
2. **Effective Dates:** Set appropriate effective dates for salary changes
3. **Testing:** Test in development before updating production structure
4. **Backup:** Backup database before major salary structure changes
5. **Communication:** Notify HR team before changing active structure

---

## 📞 Support

If you encounter issues not covered in this guide:

1. Check backend logs: `cd backend && npm run start:dev` (watch the console)
2. Check frontend console: Browser DevTools → Console tab
3. Verify database connection in `backend/.env`
4. Review the comprehensive documentation:
   - `SALARY_STRUCTURE_REFACTORING.md` - Backend details
   - `FRONTEND_SALARY_REFACTORING.md` - Frontend details
   - `COMPLETE_SALARY_REFACTORING_SUMMARY.md` - Overview

---

## ✅ Quick Checklist

After setup, verify:

- [ ] Seeder script runs successfully
- [ ] Active salary structure exists in database
- [ ] API endpoint `/salary-structures/active` returns data
- [ ] Frontend promotion modal loads salary automatically
- [ ] Staff creation shows "Automatic Salary Calculation" banner
- [ ] Creating new staff works without manual salary input
- [ ] Promotions calculate salary based on grade/step
- [ ] No console errors in browser

---

**Last Updated:** December 26, 2024  
**Status:** Production Ready  
**Script Location:** `/backend/scripts/seed-salary-structure.js`
