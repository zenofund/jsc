# SMTP Email System - Quick Setup Guide

## 🚀 Quick Start (5 Minutes)

### 1. Run Database Migration
```bash
# In Supabase SQL Editor, paste and run:
/backend/database/migrations/016_create_smtp_settings.sql
```

### 2. Add Environment Variable
```bash
# Add to /backend/.env
SMTP_ENCRYPTION_KEY=jsc-payroll-smtp-key-32-chars!
FRONTEND_URL=http://localhost:5173
```

### 3. Install Nodemailer (if not installed)
```bash
npm install nodemailer
npm install -D @types/nodemailer
```

### 4. Restart Backend
```bash
npm run start:dev
```

### 5. Configure SMTP (Web UI)
1. Login as **admin**
2. Go to: **Config & Settings** → **SMTP Settings**
3. Enter SMTP details (see examples below)
4. Click "Test Connection"
5. Click "Save Settings"

## 📧 SMTP Configuration Examples

### Gmail (Recommended for Development)
```
Host: smtp.gmail.com
Port: 587
Secure: ☐ (unchecked)
Username: your-email@gmail.com
Password: [App Password - see below]
From Email: your-email@gmail.com
From Name: JSC Payroll System
```

**Get Gmail App Password:**
1. Go to: https://myaccount.google.com/security
2. Enable "2-Step Verification"
3. Click "App passwords"
4. Generate for "Mail" on "Other"
5. Copy 16-character password

### Microsoft 365
```
Host: smtp.office365.com
Port: 587
Secure: ☐
Username: your-email@yourdomain.com
Password: [Your account password]
From Email: your-email@yourdomain.com
From Name: JSC Payroll System
```

## ✅ Test the System

### 1. Test SMTP Connection
- In SMTP Settings page
- Enter test email address
- Click "Test Connection"
- Check for success message

### 2. Test Password Reset Email
- Logout
- Click "Forgot Password"
- Enter your email
- Check inbox for reset email

### 3. Check Email Logs
- Go to SMTP Settings
- Scroll to "Email Types" section
- Verify emails are being logged

## 🔍 Verify Everything Works

```bash
# Check database tables exist
psql "your-connection-string" -c "SELECT COUNT(*) FROM smtp_settings;"
psql "your-connection-string" -c "SELECT COUNT(*) FROM email_logs;"

# Test API endpoint
curl http://localhost:3000/api/v1/email/smtp-settings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📚 Full Documentation

See `/SMTP_EMAIL_SYSTEM.md` for complete documentation including:
- All email templates
- Integration examples
- Troubleshooting guide
- Production deployment checklist

## ✅ Done!

Your SMTP email system is now configured and ready to send emails! 🎉
