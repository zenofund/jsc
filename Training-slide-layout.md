# JSC Training Slide Layout

## Purpose

This document maps `Training-deck.md` to the generated screenshot pack in `training-screens`. It tells the presentation builder exactly what should appear on each slide, which screenshot to use, and which slides should remain text-only or process-map slides.

## Asset Folder

Use screenshots from:

`c:\Users\USER\Documents\trae_projects\jsc\training-screens`

Available screenshot files:

- `01-dashboard.png`
- `02-staff-list.png`
- `03-add-staff-form.png`
- `04-notifications.png`
- `05-departments.png`
- `06-payroll-setup.png`
- `07-payroll-batches.png`
- `08-create-payroll-batch.png`
- `09-arrears.png`
- `10-approvals.png`
- `11-loan-management.png`
- `12-cooperative-management.png`
- `13-bank-payments.png`
- `14-reports.png`
- `15-audit-log.png`
- `16-admin.png`
- `17-staff-portal.png`

## Standard Slide Layout Rules

- Use a clean white background.
- Use one main screenshot per slide unless otherwise noted.
- Keep callouts short: `Start Here`, `Create`, `Review`, `Approve`, `Status`, `Export`.
- Put trainer notes in speaker notes, not on the visible slide.
- For process slides, use arrows or SmartArt instead of screenshots.
- For text-heavy concept slides, use icons and simple bullets instead of forcing screenshots.

## Slide-By-Slide Layout

### Slide 1: Title
- **Deck title:** `JSC Application User Training`
- **Visual type:** Title slide only
- **Screenshot:** None
- **Layout:** Big title, subtitle, JSC branding
- **Build note:** Use a clean title page, not a screenshot

### Slide 2: What This App Does
- **Visual type:** Text and icons
- **Screenshot:** None
- **Layout:** Two-column bullet list with simple module icons
- **Build note:** Keep this high-level and very simple

### Slide 3: Simple Big Picture
- **Visual type:** Concept diagram
- **Screenshot:** None
- **Layout:** One horizontal flow showing HR -> Payroll -> Approvals -> Finance -> Reports -> Audit
- **Build note:** This should explain the ecosystem, not show a page

### Slide 4: Main Modules
- **Visual type:** Module overview list
- **Screenshot:** None
- **Layout:** Numbered list or grouped module boxes
- **Build note:** Use icons or colored cards for each module group

### Slide 5: Who Uses What
- **Visual type:** Role mapping
- **Screenshot:** None
- **Layout:** Table or role cards
- **Build note:** Show which roles use which modules

### Slide 6: First Things First
- **Visual type:** Split visual
- **Screenshot:** `01-dashboard.png` and `04-notifications.png`
- **Layout:** Left = dashboard, right = notifications
- **Callouts:** `Start Here`, `Check Alerts`, `Open Your Work Area`
- **Build note:** This is the first practical slide with real screens

### Slide 7: Business Process Map
- **Visual type:** Process map
- **Screenshot:** None
- **Layout:** System Setup -> Staff -> Transaction -> Approval -> Payment -> Reports -> Audit
- **Build note:** Use arrows, not screenshots

### Slide 8: Module 1 - Login, Security, and Navigation
- **Visual type:** Text with placeholder note
- **Screenshot:** None from current pack
- **Layout:** Left = bullets, right = small placeholder box labeled `Login Screen To Be Captured Separately`
- **Build note:** No live login screenshot was captured because the app session was already authenticated

### Slide 9: Module 2 - Dashboard and Notifications
- **Visual type:** Split screenshot slide
- **Screenshot:** `01-dashboard.png` and `04-notifications.png`
- **Layout:** Top or left = dashboard, bottom or right = notifications
- **Callouts:** `Summary`, `Quick Actions`, `Notifications`, `Pending Work`
- **Build note:** This is one of the most important beginner slides

### Slide 10: Module 3 - Staff Management
- **Visual type:** Main screenshot plus inset
- **Screenshot:** `02-staff-list.png` and `03-add-staff-form.png`
- **Layout:** Main image = staff list, small inset = add staff form
- **Callouts:** `Search Staff`, `Add Staff`, `View Records`, `Staff Form`
- **Build note:** Show list first, then show that records are created from the form

### Slide 11: Staff Process Map
- **Visual type:** Process map with optional screen references
- **Screenshot:** Optional small thumbnails `02-staff-list.png` and `03-add-staff-form.png`
- **Layout:** Create -> Complete Details -> Assign Salary/Bank -> Save -> Use in Payroll
- **Build note:** Keep the process map dominant; screenshots should be small if used

### Slide 12: Module 4 - Departments, Setup, and Configuration
- **Visual type:** Two-screen comparison
- **Screenshot:** `05-departments.png` and `06-payroll-setup.png`
- **Layout:** Left = departments, right = payroll setup
- **Callouts:** `Departments`, `Salary Structure`, `Allowances`, `Deductions`
- **Build note:** This slide explains setup dependencies before transactions

### Slide 13: Module 5 - Leave and Staff Requests
- **Visual type:** Text and process map
- **Screenshot:** None from current pack
- **Layout:** Left = request process, right = role flow
- **Build note:** No leave or staff request screenshot is in the current pack; keep this slide diagram-based unless you want an extra capture round

### Slide 14: Module 6 - Promotions and Arrears
- **Visual type:** Main screenshot with process bullets
- **Screenshot:** `09-arrears.png`
- **Layout:** Large arrears screenshot with short process strip under it
- **Callouts:** `Pending`, `Approved`, `Processed`, `Add Adjustment`
- **Build note:** Use this as the closest live visual for promotions and arrears control

### Slide 15: Module 7 - Payroll Processing
- **Visual type:** Two-screen sequence
- **Screenshot:** `07-payroll-batches.png` and `08-create-payroll-batch.png`
- **Layout:** Left = payroll batch list, right = create batch modal
- **Callouts:** `Create Batch`, `Workflow`, `Search`, `Create`
- **Build note:** This slide should show where monthly payroll begins

### Slide 16: Payroll Business Process Map
- **Visual type:** Process map with screen thumbnails
- **Screenshot:** Optional thumbnails `07-payroll-batches.png` and `08-create-payroll-batch.png`
- **Layout:** Create -> Generate -> Review -> Submit -> Approve -> Lock -> Report
- **Build note:** The process flow should be primary; screenshots are supporting visuals only

### Slide 17: Module 8 - Approvals Workflow
- **Visual type:** Main screenshot
- **Screenshot:** `10-approvals.png`
- **Layout:** Full-width screenshot
- **Callouts:** `All Approvals`, `Tabs`, `Review`, `Actions`
- **Build note:** Focus on the approvals dashboard because it centralizes decisions

### Slide 18: Approval Process Map
- **Visual type:** Process map
- **Screenshot:** Optional small thumbnail `10-approvals.png`
- **Layout:** Submitted -> Reviewer -> Approver -> Final Decision -> Next Action
- **Build note:** Keep the flow simple and role-based

### Slide 19: Module 9 - Loans Management
- **Visual type:** Main screenshot
- **Screenshot:** `11-loan-management.png`
- **Layout:** Full-width screenshot
- **Callouts:** `Applications`, `Loan Types`, `Disbursements`, `Reports`
- **Build note:** Show that loans are not separate from payroll; they affect deductions and balances

### Slide 20: Module 10 - Cooperative Management
- **Visual type:** Main screenshot
- **Screenshot:** `12-cooperative-management.png`
- **Layout:** Full-width screenshot
- **Callouts:** `Cooperatives`, `Members`, `Contributions`, `New Cooperative`
- **Build note:** Explain that cooperative records feed payroll deductions and reporting

### Slide 21: Module 11 - Bank Payments and Cashier Workflows
- **Visual type:** Main screenshot
- **Screenshot:** `13-bank-payments.png`
- **Layout:** Full-width screenshot
- **Callouts:** `Payment Batches`, `Reconciliation`, `Exceptions`, `Bank Accounts`
- **Build note:** Reinforce that payment happens after approval, not before

### Slide 22: Module 12 - Reports and Analytics
- **Visual type:** Main screenshot
- **Screenshot:** `14-reports.png`
- **Layout:** Full-width screenshot
- **Callouts:** `Report Tabs`, `Filters`, `Export Excel`, `Export PDF`
- **Build note:** This slide should show how management gets decision-ready information

### Slide 23: Module 13 - Audit Trail and Compliance
- **Visual type:** Main screenshot
- **Screenshot:** `15-audit-log.png`
- **Layout:** Full-width screenshot
- **Callouts:** `Search Logs`, `Filter`, `Action`, `User`
- **Build note:** Keep the explanation focused on accountability and traceability

### Slide 24: Module 14 - Staff Portal
- **Visual type:** Main screenshot
- **Screenshot:** `17-staff-portal.png`
- **Layout:** Full-width screenshot
- **Callouts:** `Dashboard`, `My Profile`, `My Payslips`, `Requests`
- **Build note:** This is the self-service side of the app for ordinary staff users

### Slide 25: How All Modules Connect
- **Visual type:** Combined flow slide
- **Screenshot:** Small thumbnails from `06-payroll-setup.png`, `02-staff-list.png`, `07-payroll-batches.png`, `10-approvals.png`, `13-bank-payments.png`, `14-reports.png`, `15-audit-log.png`
- **Layout:** Horizontal flow with six or seven thumbnails connected by arrows
- **Build note:** This is the best place to use multiple small screenshots on one slide

### Slide 26: Common Mistakes to Avoid
- **Visual type:** Text warning slide
- **Screenshot:** None
- **Layout:** Bullet list with warning icons
- **Build note:** Keep it simple and readable

### Slide 27: Best Practice Rules
- **Visual type:** Text checklist
- **Screenshot:** None
- **Layout:** Checklist with green icons
- **Build note:** This is a behavior slide, not a product screenshot slide

### Slide 28: 2-Day Training Flow
- **Visual type:** Agenda timeline
- **Screenshot:** None
- **Layout:** Day 1 on left, Day 2 on right
- **Build note:** Show the learning journey clearly

### Slide 29: Simple Role-Based Learning Path
- **Visual type:** Role path cards
- **Screenshot:** Optional small thumbnails:
  - HR = `02-staff-list.png`
  - Payroll = `07-payroll-batches.png`
  - Approver = `10-approvals.png`
  - Finance = `13-bank-payments.png`
  - Admin = `16-admin.png`
- **Layout:** One card per role
- **Build note:** Use screenshots only as small visual anchors

### Slide 30: Final Takeaway
- **Visual type:** Closing summary
- **Screenshot:** Optional faint background using `01-dashboard.png`
- **Layout:** Big summary bullets over a light faded background
- **Build note:** End with simple takeaways, not a busy page

## Recommended Build Order

Build the slide deck in this order:

1. Create all text-only and process-map slides first
2. Insert major module screenshots next
3. Add callouts only after screenshots are placed
4. Keep callouts to 3 to 5 per slide
5. Add speaker notes last

## Best Screenshot Use

Use these slides as the strongest visual anchors in the deck:

- `01-dashboard.png`
- `02-staff-list.png`
- `06-payroll-setup.png`
- `07-payroll-batches.png`
- `10-approvals.png`
- `11-loan-management.png`
- `12-cooperative-management.png`
- `13-bank-payments.png`
- `14-reports.png`
- `15-audit-log.png`
- `17-staff-portal.png`

## Gaps To Note

The current screenshot pack does not yet include:

- Login page
- Change password page
- Leave management page
- Staff requests page
- Promotions page
- Payslips page

If you want a complete 30-slide visual deck with no placeholders, these screens should be captured in a second screenshot round.

## Expected Result

Using this layout, the presentation builder can create:

- a clean 30-slide training deck
- a logical flow from basics to advanced modules
- a beginner-friendly presentation with the right balance of text, process maps, and real screens
