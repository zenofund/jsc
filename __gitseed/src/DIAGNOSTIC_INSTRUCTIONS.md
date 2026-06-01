# 🔍 NOTIFICATION DIAGNOSTIC INSTRUCTIONS

## ✅ What Was Changed

We've added extensive **console logging** to help diagnose the notification issue.

### Modified Files:
1. `/components/NotificationDropdown.tsx` - Added detailed logging
2. `/lib/api-client.ts` - Added API call logging

---

## 🧪 How to Diagnose the Issue

### Step 1: Open Browser Console
1. Open your app in the browser
2. Press `F12` to open DevTools
3. Go to the **Console** tab

### Step 2: Open the Notification Dropdown
1. Click the **bell icon** in the top navigation
2. Watch the console output

---

## 📊 What to Look For in Console

### ✅ Expected Output (Live Backend Working):
```
🔔 NotificationDropdown: Fetching notifications from API...
👤 User: { id: "user-123", role: "admin" }
🔧 API Client: getUserNotifications called
⚙️ Backend mode: nestjs
🚀 Using NestJS backend
🌐 API URL: http://localhost:3000/api/v1
📡 Fetching from: http://localhost:3000/api/v1/notifications?
📨 Response status: 200
📦 Received data: []
✅ NotificationDropdown: Received notifications: 0
📋 Notifications data: []
🔢 Unread count: 0
```

### ❌ Problem 1: Backend Not Running
```
🔔 NotificationDropdown: Fetching notifications from API...
👤 User: { id: "user-123", role: "admin" }
🔧 API Client: getUserNotifications called
⚙️ Backend mode: nestjs
🚀 Using NestJS backend
🌐 API URL: http://localhost:3000/api/v1
📡 Fetching from: http://localhost:3000/api/v1/notifications?
❌ API request failed: TypeError: Failed to fetch
❌ NotificationDropdown: Failed to fetch notifications: Error: Failed to fetch notifications
```

**Solution:** Start your backend server:
```bash
cd backend
npm run start:dev
```

### ❌ Problem 2: Using IndexedDB (Wrong!)
```
🔔 NotificationDropdown: Fetching notifications from API...
👤 User: { id: "user-123", role: "admin" }
🔧 API Client: getUserNotifications called
⚙️ Backend mode: indexeddb  ← THIS IS WRONG!
📦 Using IndexedDB backend
```

**Solution:** This shouldn't happen anymore, but if it does:
Check `/lib/api-client.ts` line 10:
```typescript
backend: 'nestjs' as 'indexeddb' | 'nestjs',  // Should be 'nestjs'
```

### ❌ Problem 3: Database Not Set Up
```
🔔 NotificationDropdown: Fetching notifications from API...
...
📨 Response status: 500
❌ API request failed: 500 Internal Server Error
❌ NotificationDropdown: Failed to fetch notifications: Error: Failed to fetch notifications
```

**Solution:** Run the database migration:
1. Go to Supabase Dashboard → SQL Editor
2. Copy content from `/database/migrations/011_update_notifications_table.sql`
3. Run it

---

## 🎯 Likely Issue: No Notifications in Database

If you see:
```
✅ NotificationDropdown: Received notifications: 0
📋 Notifications data: []
🔢 Unread count: 0
```

This means **the API is working** but there are **no notifications in the database yet**!

---

## 💡 How to Create Test Notifications

### Option 1: Use the Seeder (Recommended)

Open browser console and run:
```javascript
// Import the seeder
const { seedDemoNotifications } = await import('/src/lib/notification-seeder.ts');

// Seed notifications for your user
await seedDemoNotifications('your-user-id', 'admin');
```

### Option 2: Create via API (cURL)

```bash
# Create a test notification
curl -X POST http://localhost:3000/api/v1/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "recipient_id": "your-user-id",
    "type": "system",
    "category": "info",
    "title": "Test Notification",
    "message": "This is a test notification from the backend!",
    "priority": "medium"
  }'
```

### Option 3: Trigger a System Event

Do something that creates a notification:
1. Submit a payroll batch (creates notification for approvers)
2. Request leave (creates notification for managers)
3. Process a loan (creates notification for staff)

---

## 🔍 Check Network Tab

1. Open DevTools → **Network** tab
2. Filter by: `XHR` or `Fetch`
3. Click the bell icon
4. Look for requests to: `localhost:3000/api/v1/notifications`

### ✅ What You Should See:
- Request URL: `http://localhost:3000/api/v1/notifications`
- Status: `200 OK`
- Response: JSON array (even if empty: `[]`)

### ❌ What You Shouldn't See:
- Status: `Failed` or `500 Error`
- No requests at all (means frontend not calling API)
- Requests to IndexedDB (means using wrong backend)

---

## 📝 Checklist

- [ ] Backend server is running (`npm run start:dev` in backend folder)
- [ ] Migration script has been executed in Supabase
- [ ] Console shows "🚀 Using NestJS backend"
- [ ] Network tab shows requests to localhost:3000
- [ ] Response status is 200
- [ ] There are notifications in the database (or create test notifications)

---

## 🆘 Still Seeing Mock Data?

If you're **absolutely sure** you're seeing mock data (like "Payroll Batch PB-2024-01 Created" from December), then:

1. **Clear your browser cache:**
   - Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
   - Clear "Cached images and files"
   - Clear "Site data"

2. **Clear localStorage:**
   Open console and run:
   ```javascript
   localStorage.clear();
   location.reload();
   ```

3. **Check if IndexedDB has old data:**
   ```javascript
   // Check IndexedDB stores
   indexedDB.databases().then(console.log);
   
   // Delete IndexedDB (this will clear mock data)
   indexedDB.deleteDatabase('JSC-PMS');
   location.reload();
   ```

4. **Hard refresh:**
   - Windows: `Ctrl+Shift+R`
   - Mac: `Cmd+Shift+R`

---

## 📸 Take Screenshots

If still having issues, take screenshots of:

1. **Console tab** - showing the logs
2. **Network tab** - showing the API requests
3. **Backend terminal** - showing server logs
4. **The actual notifications** - what you're seeing as "mock data"

This will help identify exactly what's happening!

---

## 🎯 Expected Flow

1. User clicks bell icon
2. Console: "🔧 API Client: getUserNotifications called"
3. Console: "⚙️ Backend mode: nestjs"
4. Console: "📡 Fetching from: http://localhost:3000/api/v1/notifications"
5. Network tab: Shows request to backend
6. Backend terminal: Shows SQL query
7. Console: "📦 Received data: [...]"
8. Dropdown: Shows notifications from database

---

**Status:** Diagnostic logging enabled ✅  
**Next:** Open console and click the bell icon to see what's happening!
