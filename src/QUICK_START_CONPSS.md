# 🚀 CONPSS Quick Start Guide

## Official CONPSS 2024 - Monthly Pay

**CONPSS** = **Con**solidated **P**ublic **S**ervice **S**alary **S**tructure

✅ **Correct Naming:** CONPSS (not CONMESS)  
✅ **Pay Frequency:** Monthly (converted from annual)  
✅ **Conversion:** Annual values ÷ 12 = Monthly pay  
✅ **Structure:** GL01-GL14 (15 steps), GL15-GL17 (9 steps)

---

## One-Minute Setup

### **Option 1: Using Node.js Seeder (Recommended)**

```bash
cd backend
npm run db:seed-conpss
```

### **Option 2: Using SQL Migration**

```bash
cd backend
npm run db:migrate-conpss
```

**Results:**
✅ Creates official CONPSS 2024 structure  
✅ 17 grade levels × 15 steps = 255 salary values  
✅ Monthly range: ₦75,624 - ₦309,909  
✅ Annual range: ₦907,488 - ₦3,718,908  

---

## Test It Works

```bash
cd backend
npm run test:salary-api
```

✅ Verifies backend running  
✅ Confirms CONPSS structure active  
✅ Tests monthly salary lookups  

---

## 📊 CONPSS Monthly Salaries

| Position | Grade/Step | Monthly Pay | Annual Equivalent |
|----------|------------|-------------|-------------------|
| Entry Level | GL1 Step 1 | ₦75,624 | ₦907,488 |
| Mid-Career | GL7 Step 1 | ₦114,580 | ₦1,374,960 |
| Senior | GL10 Step 1 | ₦140,448 | ₦1,685,376 |
| Management | GL12 Step 1 | ₦161,110 | ₦1,933,320 |
| Director | GL17 Step 9 | ₦269,432 | ₦3,231,984 |

**Note:** GL15-GL17 have only 9 steps (senior management levels)

---

## 🔧 Available Commands

```bash
# Seed official CONPSS structure (Node.js)
npm run db:seed-conpss

# Run SQL migration
npm run db:migrate-conpss

# Test API endpoints
npm run test:salary-api

# Start backend server
npm run start:dev
```

---

## 💡 Important Notes

1. **Monthly vs Annual:**
   - Original CONPSS document shows annual salaries
   - System stores monthly values (Annual ÷ 12)
   - All payroll calculations use monthly values

2. **CONPSS vs CONMESS:**
   - CONPSS = Public Service (all government workers)
   - CONMESS = Medical Service (health workers only)
   - This system uses CONPSS ✅

3. **Automatic Deletion:**
   - Seeder removes old CONMESS structures
   - Replaces with correct CONPSS data
   - Safe to run multiple times

---

## ✅ Success Checklist

- [ ] Backend running (`npm run start:dev`)
- [ ] Database connected (check `.env`)
- [ ] CONPSS seeded (`npm run db:seed-conpss`)
- [ ] API tested (`npm run test:salary-api`)
- [ ] Frontend tested (create staff, check monthly salary)

---

## 🆘 Quick Troubleshooting

**Problem:** "No active salary structure"  
**Solution:** Run `npm run db:seed-conpss`

**Problem:** Backend not running  
**Solution:** `cd backend && npm run start:dev`

**Problem:** Still seeing CONMESS references  
**Solution:** Seeder will auto-delete old CONMESS data

---

## 📚 Documentation

- `CONPSS_SALARY_STRUCTURE_EXTRACTED.md` - Full monthly salary matrix
- `001_update_salary_structure_to_conpss.sql` - SQL migration file
- `seed-conpss-salary-structure.js` - Node.js seeder script

---

**Your system now uses official CONPSS monthly rates! 🎉**