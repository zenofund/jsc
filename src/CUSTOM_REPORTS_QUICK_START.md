# 🚀 Custom Reports - Quick Start Guide

## ✅ **Everything is Ready!**

Your Custom Report Builder UI is **100% complete** with **live backend integration**. Here's how to use it:

---

## 🎯 **Quick Access**

### **From Sidebar Navigation Menu:**

1. Login to JSC-PMS
2. Click on **"Reporting & Analytics"** group in the sidebar
3. Choose:
   - **"Custom Reports"** - Browse and execute saved reports
   - **"Report Builder"** - Create new custom reports

### **From JavaScript Console or Code:**

```javascript
// Open Report Builder
(window as any).navigateTo('custom-report-builder')

// Open Reports List
(window as any).navigateTo('reports-list')
```

---

## 📝 **How to Create Your First Report**

### **Step 1: Open Report Builder**

```javascript
(window as any).navigateTo('custom-report-builder')
```

### **Step 2: Fill Basic Info**

```
Report Name: Active Staff Report
Category: Staff
Description: List of all active employees
☐ Make public
```

### **Step 3: Select Data Source**

```
Table: [Staff         ▼]
```

### **Step 4: Add Fields**

Click on field badges to add them:
- Click `[+ Staff Number]`
- Click `[+ First Name]`
- Click `[+ Last Name]`
- Click `[+ Email]`

### **Step 5: Add Join (Optional)**

To include department name:
1. Go to "Joins" tab
2. Click "Add Join"
3. Select: `departments` (LEFT JOIN)

Now click `[+ Department]` badge to add department name field

### **Step 6: Add Filter**

1. Go to "Filters" tab
2. Click "Add Filter"
3. Configure:
   - Field: `status`
   - Operator: `Equals`
   - Value: `active`

### **Step 7: Preview**

Click **[Preview]** button → See live data in preview panel!

### **Step 8: Save**

Click **[Save Report]** → Report saved to database!

---

## 🎯 **Execute Saved Reports**

### **From Reports List:**

```javascript
// 1. Navigate to reports list
(window as any).navigateTo('reports-list')

// 2. Find your report
// 3. Click "Execute" button
// 4. View results in modal
// 5. Export as CSV
```

---

## 📊 **Example Reports to Build**

### **1. Department Salary Summary**

```
Table: staff
Fields:
  - departments.name (alias: "Department")
  - COUNT(staff.id) (alias: "Staff Count")
  - SUM(staff.current_basic_salary) (alias: "Total Salary")
  - AVG(staff.current_basic_salary) (alias: "Average Salary")
Joins:
  - departments (LEFT JOIN)
Group By:
  - departments.name
Order By:
  - SUM(staff.current_basic_salary) DESC
```

**Result:** Shows total staff and salaries per department

### **2. Pending Loan Applications**

```
Table: loan_applications
Fields:
  - loan_applications.application_number
  - staff.staff_number
  - staff.first_name
  - staff.last_name
  - loan_applications.requested_amount
  - loan_types.name (alias: "Loan Type")
Joins:
  - staff (INNER JOIN)
  - loan_types (LEFT JOIN)
Filters:
  - loan_applications.status = "pending"
  - loan_applications.requested_amount > 200000
Order By:
  - loan_applications.requested_amount DESC
```

**Result:** High-value pending loans sorted by amount

### **3. January 2024 Leave Report**

```
Table: leave_requests
Fields:
  - staff.staff_number
  - staff.first_name
  - leave_types.name (alias: "Leave Type")
  - leave_requests.start_date
  - leave_requests.end_date
  - leave_requests.number_of_days
Joins:
  - staff (INNER JOIN)
  - leave_types (LEFT JOIN)
Filters:
  - leave_requests.start_date BETWEEN ["2024-01-01", "2024-01-31"]
  - leave_requests.status = "approved"
Order By:
  - leave_requests.start_date ASC
```

**Result:** All approved leave in January 2024

---

## 🔧 **Environment Setup**

### **Required:**

```env
# .env or .env.local
REACT_APP_API_URL=http://localhost:3000/api/v1
```

### **Backend Must Be Running:**

```bash
cd backend
npm run start:dev

# Should show: NestJS app listening on port 3000
```

### **Database Schema Applied:**

```bash
psql $DATABASE_URL < database/reports-schema.sql
```

---

## 🎨 **Available Data Sources**

| Table | Use For |
|-------|---------|
| `staff` | Employee information, demographics |
| `departments` | Organizational structure |
| `payroll_batches` | Payroll summaries by month |
| `payroll_lines` | Detailed payroll records |
| `loan_applications` | Loan requests and approvals |
| `leave_requests` | Leave applications |
| `cooperatives` | Cooperative memberships |
| `audit_trail` | System activity logs |

---

## 🎯 **Filter Operators**

| Operator | Use For | Example |
|----------|---------|---------|
| `=` | Exact match | status = "active" |
| `!=` | Not equal | status != "terminated" |
| `>` | Greater than | salary > 200000 |
| `<` | Less than | days < 30 |
| `>=` | Greater or equal | amount >= 100000 |
| `<=` | Less or equal | tenure <= 12 |
| `LIKE` | Contains text | name LIKE "John" |
| `IN` | In list | status IN ["pending", "approved"] |
| `NOT IN` | Not in list | category NOT IN ["expired"] |
| `BETWEEN` | Range | date BETWEEN ["2024-01-01", "2024-12-31"] |
| `IS NULL` | Empty field | end_date IS NULL |
| `IS NOT NULL` | Not empty | email IS NOT NULL |

---

## 📤 **Export Options**

### **CSV Export** (Working Now):

1. Execute report
2. View results in modal
3. Click **[CSV]** button
4. File downloads automatically

### **Excel & PDF Export** (Backend Ready):

Will be enabled when connected to backend export endpoints.

---

## ⭐ **Tips & Tricks**

### **1. Use Favorites**

Star reports you use frequently for quick access:
- Click the ⭐ icon on any report card
- Access from "Favorites" tab

### **2. Make Reports Public**

Share reports with all users:
- Check "Make this report public" when saving
- Others can view and execute (but not edit)

### **3. Use Joins for Richer Data**

Always join to get descriptive names:
- Staff → Departments (get department name)
- Loans → Loan Types (get loan type name)
- Leave → Leave Types (get leave type name)

### **4. Group for Summaries**

Use GROUP BY with aggregates:
- SUM(salary) grouped by department
- COUNT(staff) grouped by location
- AVG(amount) grouped by loan type

### **5. Test with Preview**

Always preview before saving:
- Ensures query works
- Validates filters
- Shows sample data
- Checks performance

---

## 🚨 **Troubleshooting**

### **"No authentication token found"**

```javascript
// Check if token exists:
localStorage.getItem('auth_token')

// If null, you need to login first
// The token is set automatically after successful login
```

### **"Failed to load data sources"**

```bash
# Check backend is running:
curl http://localhost:3000/api/v1/health

# Should return: {"status": "ok"}
```

### **"Report execution failed"**

Common causes:
1. Invalid field names → Use exact field names from data sources
2. Missing join → Join table before using its fields
3. Invalid filter value → Check operator matches field type
4. Database error → Check backend logs

### **Preview shows no data**

This is OK if:
- Filters exclude all records
- Table is actually empty
- Join removes all records

Check by removing filters and trying again.

---

## 📞 **Support**

### **Documentation:**

- `/backend/src/modules/reports/REPORTS_GUIDE.md` - Complete backend guide
- `/CUSTOM_REPORT_BUILDER_UI_COMPLETE.md` - Full UI documentation
- `/lib/reportsAPI.ts` - API client with TypeScript types

### **Backend Endpoints:**

```bash
# View Swagger docs:
http://localhost:3000/api/docs

# Navigate to "Custom Reports" section
# All 13 endpoints documented with examples
```

---

## ✅ **Checklist Before Using**

- [ ] Backend server running (`npm run start:dev`)
- [ ] Database schema applied (`reports-schema.sql`)
- [ ] Environment variable set (`REACT_APP_API_URL`)
- [ ] Logged in (JWT token in localStorage)
- [ ] Sample data in database (run seeder if needed)

---

## 🎉 **You're Ready!**

**Navigate to the Report Builder and start creating custom reports:**

```javascript
(window as any).navigateTo('custom-report-builder')
```

**Or browse existing reports:**

```javascript
(window as any).navigateTo('reports-list')
```

**Happy Reporting!** 📊🚀