# cPanel Deployment Guide - JSC Payroll Management System (Frontend)

Since the frontend is a **Single Page Application (SPA)** built with Vite, deploying to cPanel is straightforward as it only requires hosting static files.

---

## 🚀 Step-by-Step Deployment

### **Step 1: Build the Application Locally**
1. Ensure your `.env` file has the correct production backend URL:
   ```env
   VITE_API_URL=https://your-backend-on-render.com/api/v1
   ```
2. Run the build command in your terminal:
   ```bash
   npm run build
   ```
3. This creates a `build/` (or `dist/`) folder in your project root.

### **Step 2: Prepare the Files**
1. Open the `build/` folder.
2. Select all files and folders inside it.
3. Right-click and **Compress** them into a `.zip` file (e.g., `frontend-build.zip`).

### **Step 3: Upload to cPanel**
1. Log in to your **cPanel dashboard**.
2. Open **File Manager**.
3. Navigate to `public_html` (or your subdomain folder).
4. Click **Upload** and select your `frontend-build.zip`.
5. Once uploaded, right-click the zip file and select **Extract**.

### **Step 4: Configure Client-Side Routing (.htaccess)**
Since this is a React app, you need to ensure that refreshing the page doesn't result in a 404 error. 

1. In the `public_html` folder, look for a `.htaccess` file. If it doesn't exist, click **+ File** and name it `.htaccess`.
2. Right-click the `.htaccess` file and select **Edit**.
3. Paste the following configuration:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_FILENAME} !-l
  RewriteRule . /index.html [L]
</IfModule>
```
4. Click **Save Changes**.

---

## 📋 Checklist
- [ ] `VITE_API_URL` is set to the production backend with the prefix (e.g., `/api/v1`).
- [ ] Files are extracted directly in `public_html` (not in a subfolder like `public_html/build/`).
- [ ] `.htaccess` is configured to prevent 404 errors on refresh.
- [ ] SSL (HTTPS) is enabled in cPanel (via Let's Encrypt or similar).

---

## 🔧 Common Issues
- **White Screen:** Check the browser console (F12). It usually means a file path issue or a failed API connection.
- **404 on Refresh:** Ensure the `.htaccess` file is correctly placed and has the code above.
- **404 (Cannot GET /auth/login):** Ensure your `VITE_API_URL` includes the backend prefix (e.g., `https://your-api.com/api/v1`).
- **CORS Error:** Ensure your backend on Render has the cPanel domain in its `CORS_ORIGIN` environment variable.

Your frontend is now ready for the users! 🚀
