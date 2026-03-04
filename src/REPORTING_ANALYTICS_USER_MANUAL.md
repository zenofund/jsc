# Reporting & Analytics User Manual

## Purpose
Use Reporting & Analytics to:
- Review staff, payroll, variance, and remittance insights
- Export printable/shareable report files
- Build and run reusable custom reports from live data

---

## Accessing Reports
1. Sign in to the application.
2. Open the left navigation.
3. Click **Reporting & Analytics**.
4. Choose one of:
   - **Reports** (standard operational reports)
   - **Custom Reports** (saved custom templates)
   - **Report Builder** (create a new custom report)

---

## Role-Based Access
- **Cashier users** see only:
  - Variance Report
  - Remittance Report
- Other authorized users see:
  - Staff Report
  - Payroll Report
  - Variance Report
  - Remittance Report

If you see a permission error, contact an administrator to update your role access.

---

## Standard Reports Workflow

### 1) Staff Report
Use this for workforce distribution and staff listing.

Steps:
1. Open **Reports**.
2. Select **Staff Report** tab.
3. Set filters:
   - Department (optional)
   - Status (Active/Inactive, optional)
4. Review:
   - Total staff
   - Department/grade distributions
   - Staff details table
5. Use search in table when needed.

### 2) Payroll Report
Use this for month payroll totals and detailed payroll lines.

Steps:
1. Select **Payroll Report** tab.
2. Pick the month using the month selector.
3. Review summary cards:
   - Total staff
   - Total basic salary
   - Total gross pay
   - Total net pay
4. Review line-by-line payroll table.
5. Use table search to find specific staff quickly.

### 3) Variance Report
Use this to compare 2 months.

Steps:
1. Select **Variance Report** tab.
2. Choose **Month 1** and **Month 2**.
3. Review:
   - Net pay totals per month
   - Amount variance
   - Percentage change
   - Detailed variance table

### 4) Remittance Report
Use this for statutory/cooperative remittance checks.

Steps:
1. Select **Remittance Report** tab.
2. Choose month.
3. Choose remittance type:
   - Pension
   - Tax
   - Cooperative
4. Review totals and detailed remittance rows.

---

## Exporting Standard Reports
On the **Reports & Analytics** page header:
- Click **Export CSV** for spreadsheet-style output.
- Click **Export PDF** for presentation/print output.

Tip: Set your filters and month before exporting.

---

## Custom Reports Workflow

## Step A: Manage Existing Custom Reports
1. Open **Custom Reports**.
2. Use:
   - Search box
   - Category filters
   - Tabs: All, Favorites, My Reports, Shared with Me
3. For each report card, use actions:
   - Execute
   - Add/Remove favorite
   - Edit (if permitted)
   - Delete (owner only)

When executed, results open in a dialog with export options:
- CSV
- Excel
- PDF

## Step B: Create a New Custom Report
1. In **Custom Reports**, click **Create New Report**.
2. In **Custom Report Builder**:
   - Enter **Report Name** (required)
   - Select **Category**
   - Add description (optional)
   - Set row limit (optional)
   - Set **Public** if all users should see it
3. Select **Data Source** (base table).
4. Add required **Fields**.
5. Configure optional:
   - Filters
   - Joins
   - Grouping
   - Sorting
6. Click **Preview** to run with live data.
7. Click **Save Report** to store the template.

---

## Validation Rules You Should Know
- You cannot preview or save without selecting at least one field.
- You cannot save without a report name.
- If no auth token/session exists, API calls fail until you sign in again.

---

## Troubleshooting
- **No data returned**
  - Check month/filter selections
  - Confirm underlying payroll/staff records exist for selected period
- **Permission denied**
  - Your role may not allow that report type
- **Export issue**
  - Re-run the report first, then export
  - Try CSV if PDF rendering is blocked by browser settings

---

## Best Practices
- Always set filters/month first, then export.
- Save frequently used filters as custom reports.
- Keep custom report names clear (for example: `Monthly Payroll Summary - Finance`).
- Use Favorites tab for quick access to routine reports.
