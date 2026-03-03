# 🏛️ JSC Payroll Management System (JSC-PMS)

## Nigerian Judicial Service Committee - Comprehensive Payroll Management System

A full-stack enterprise payroll management system built with **React**, **NestJS**, and **Supabase** for the Nigerian Judicial Service Committee, handling complete payroll lifecycle for 800+ staff members.

---

## 🎉 **LIVE BACKEND STATUS**

```
✅ Total Endpoints: 113 LIVE API Endpoints
✅ Backend: NestJS + Supabase PostgreSQL
✅ Notifications Module: ACTIVATED (13 endpoints)
✅ All Modules: Connected to Live Database
```

**Latest Update**: Notifications Module activated with live backend integration!  
📖 See: `/NOTIFICATION_BACKEND_ACTIVATED.md` for activation details

---

## 🎯 Features

### ✅ **Staff Management**
- Complete staff onboarding and lifecycle management
- Auto-generated staff numbers (JSC/YYYY/XXXXX)
- Department and designation management
- Bulk import support (800+ records)
- Employment records and history

### ✅ **Payroll Processing**
- Monthly batch processing
- Nigerian PAYE progressive tax calculation
- Pension (10%) and NHF (2.5%) auto-deduction
- Three-tier allowances system
- Multi-level deductions
- Arrears engine
- Promotion with automatic arrears calculation
- Multi-level approval workflow

### ✅ **Allowances & Deductions**
- Global allowance configuration
- Staff-specific allowances
- Fixed amount or percentage-based
- Taxable/non-taxable flags
- Statutory and voluntary deductions
- Priority-based deduction ordering

### ✅ **Cooperative Management**
- Multi-cooperative support (staff can join multiple)
- Member registration and tracking
- Monthly contribution auto-deduction
- Contribution history
- Cooperative types: Savings, Credit, Multi-purpose, Thrift

### ✅ **Loan Management**
- Multiple loan types
- Guarantor system
- Interest calculation
- Automatic repayment via payroll
- Approval workflow
- Outstanding balance tracking

### ✅ **Leave Management**
- Multiple leave types (Annual, Sick, Maternity, etc.)
- Annual entitlement tracking
- Leave balance management
- Automatic unpaid leave deductions
- Relief officer assignment
- Approval workflow

### ✅ **Reports & Analytics**
- Custom report builder with live backend
- Standard reports (Staff, Payroll, Variance, Remittance)
- Export to CSV, Excel, PDF
- Scheduled reports
- Real-time analytics dashboard

### ✅ **Notifications**
- In-app notification system
- Real-time updates
- Role-based notifications
- Unread count badge
- Action deep-linking

### ✅ **Audit Trail**
- Complete activity logging
- User action tracking
- Old/new value comparison
- IP address logging
- Full compliance support

---

## 🏗️ Architecture

### **Frontend**
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS v4
- **State Management**: React Context API
- **Routing**: React Router v6
- **Data Storage**: IndexedDB (local) + Supabase (production)
- **Build Tool**: Vite

### **Backend**
- **Framework**: NestJS (Node.js)
- **Language**: TypeScript
- **Database**: PostgreSQL (Supabase)
- **Authentication**: JWT
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI
- **Architecture**: Modular, Clean Architecture

### **Database**
- **Platform**: Supabase (PostgreSQL)
- **Tables**: 27 tables
- **Indexes**: Optimized for performance
- **Relationships**: Fully normalized schema
- **Migrations**: SQL schema files

---

## 📊 System Statistics

- **Backend Modules**: 14
- **API Endpoints**: 107 live endpoints
- **Database Tables**: 27 tables
- **Frontend Pages**: 15+ pages
- **User Roles**: 7 role types
- **Staff Capacity**: 800+ staff members
- **Lines of Code**: 10,000+ lines

---

## 🚀 Quick Start

### **Prerequisites**
- Node.js v16+ 
- npm or yarn
- Supabase account (free tier works)

### **Option 1: Automated Start (Recommended)**

#### **Linux/Mac:**
```bash
chmod +x start-dev.sh
./start-dev.sh
```

#### **Windows:**
```bash
start-dev.bat
```

### **Option 2: Manual Start**

#### **1. Clone Repository**
```bash
git clone <repository-url>
cd jsc-pms
```

#### **2. Setup Backend**
```bash
cd backend

# Copy environment template
cp .env.example .env

# Edit .env with your Supabase credentials
nano .env

# Install dependencies
npm install

# Start backend server
npm run start:dev
```

#### **3. Setup Frontend (New Terminal)**
```bash
# From root directory
npm install

# Start frontend
npm run dev
```

#### **4. Access Application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- API Docs: http://localhost:3000/api/docs

---

## 🔧 Configuration

### **Backend Environment Variables**

Create `/backend/.env`:

```env
# Server
PORT=3000
NODE_ENV=development
API_PREFIX=api/v1

# CORS
CORS_ORIGIN=http://localhost:5173

# Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRATION=7d
```

### **Database Setup**

1. Create Supabase project at https://supabase.com
2. Go to SQL Editor
3. Copy content from `/database/schema.sql`
4. Execute SQL to create all 27 tables

---

## 📚 Documentation

- **[Backend Startup Guide](BACKEND_STARTUP_GUIDE.md)** - Complete backend setup
- **[Troubleshooting Guide](TROUBLESHOOTING.md)** - Common errors and fixes
- **[API Endpoints](backend/API_ENDPOINTS.md)** - All 107 endpoints documented
- **[Module Summary](backend/MODULE_SUMMARY.md)** - Backend modules overview
- **[Migration Status](SYSTEM_MIGRATION_STATUS.md)** - Current migration progress
- **[Error Fix Summary](ERROR_FIX_SUMMARY.md)** - Recent fixes

---

## 🧪 Testing

### **Backend Health Check**
```bash
# Basic health
curl http://localhost:3000/api/v1/health

# Database connection
curl http://localhost:3000/api/v1/health/database
```

### **API Documentation**
Visit: http://localhost:3000/api/docs

Test all 107 endpoints using Swagger UI

---

## 👥 User Roles

1. **Admin** - Full system access
2. **Payroll/HR Manager** - Payroll and staff management
3. **Payroll Officer** - Payroll processing
4. **Accountant** - Financial approval
5. **Auditor** - Read-only audit access
6. **Department Head** - Department-level management
7. **Staff** - Self-service portal

---

## 🎨 Design System

- **Primary Color**: Nigerian Green (#008000)
- **Accent Color**: Gold (#b5a642)
- **Typography**: System fonts with optimized sizes
- **Theme**: Light + Dark mode support
- **Responsive**: Mobile-first design
- **Accessibility**: WCAG 2.1 AA compliant

---

## 📦 Project Structure

```
jsc-pms/
├── backend/                    # NestJS backend
│   ├── src/
│   │   ├── modules/           # 14 feature modules
│   │   ├── common/            # Shared utilities
│   │   └── main.ts           # Entry point
│   ├── .env.example          # Environment template
│   └── package.json
│
├── src/                       # React frontend
│   ├── components/           # Reusable components
│   ├── pages/               # Page components
│   ├── contexts/            # React contexts
│   ├── lib/                 # API clients
│   └── styles/              # Global styles
│
├── database/                 # Database schemas
│   └── schema.sql           # Complete schema (27 tables)
│
├── start-dev.sh             # Linux/Mac startup script
├── start-dev.bat            # Windows startup script
└── README.md               # This file
```

---

## 🔐 Security Features

- **Authentication**: JWT-based with refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **Password Security**: bcrypt hashing
- **SQL Injection**: Parameterized queries
- **XSS Protection**: Input sanitization
- **CORS**: Configured origins
- **Audit Trail**: Complete activity logging
- **Session Management**: Secure token storage

---

## 📈 Performance

- **Bulk Operations**: Process 800+ staff in single batch
- **Database Pooling**: Optimized connection management
- **Pagination**: All lists support pagination
- **Lazy Loading**: On-demand data fetching
- **Caching**: Strategic caching for static data
- **Indexing**: Database indexes on key columns

---

## 🐛 Troubleshooting

### **"Failed to fetch" Error**

**Cause**: Backend server not running

**Solution**:
```bash
cd backend
npm run start:dev
```

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more solutions.

---

## 🛠️ Development

### **Backend Development**
```bash
cd backend

# Development mode (auto-reload)
npm run start:dev

# Build for production
npm run build

# Production mode
npm run start:prod
```

### **Frontend Development**
```bash
# Development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🚢 Deployment

### **Backend Deployment**
- **Recommended**: Railway, Render, or Heroku
- Set environment variables
- Configure Supabase connection
- Enable HTTPS

### **Frontend Deployment**
- **Recommended**: Vercel, Netlify, or Cloudflare Pages
- Build: `npm run build`
- Deploy `dist` folder
- Set `VITE_API_URL` to production backend URL

---

## 📝 API Endpoints (Summary)

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Health | 3 | System health checks |
| Auth | 3 | Authentication |
| Departments | 2 | Department management |
| Staff | 9 | Staff CRUD operations |
| Salary Structures | 10 | Salary management |
| Allowances | 9 | Global allowances |
| Deductions | 9 | Global deductions |
| Payroll | 6 | Payroll processing |
| Cooperatives | 10 | Cooperative management |
| Loans | 11 | Loan management |
| Leave | 11 | Leave management |
| Notifications | 7 | In-app notifications |
| Audit | 5 | Audit trail |
| Reports | 13 | Custom & standard reports |
| **TOTAL** | **107** | **All Live APIs** |

---

## 🏆 Key Achievements

✅ **107 Live API Endpoints** - All connected to Supabase  
✅ **27 Database Tables** - Fully integrated  
✅ **14 Backend Modules** - Production ready  
✅ **9 Frontend Modules** - Live backend integration  
✅ **800+ Staff Capacity** - Tested and optimized  
✅ **Zero Downtime Migration** - Seamless transition  
✅ **Complete Documentation** - Comprehensive guides  
✅ **Enterprise-Grade Security** - Production ready  

---

## 📞 Support

### **Documentation**
- Backend Startup: [BACKEND_STARTUP_GUIDE.md](BACKEND_STARTUP_GUIDE.md)
- Troubleshooting: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- API Docs: http://localhost:3000/api/docs

### **Health Checks**
```bash
# Backend health
curl http://localhost:3000/api/v1/health

# Database connection
curl http://localhost:3000/api/v1/health/database
```

---

## 📄 License

Proprietary - Nigerian Judicial Service Committee

---

## 🎉 Getting Started Checklist

- [ ] Clone repository
- [ ] Install Node.js v16+
- [ ] Create Supabase account
- [ ] Setup backend `.env` file
- [ ] Run database schema in Supabase
- [ ] Start backend: `cd backend && npm run start:dev`
- [ ] Start frontend: `npm run dev`
- [ ] Test health checks
- [ ] Login to application
- [ ] Explore features!

---

## 🚀 Ready to Start?

### **Quick Start (One Command)**

**Linux/Mac:**
```bash
./start-dev.sh
```

**Windows:**
```bash
start-dev.bat
```

Then visit: **http://localhost:5173**

---

**Built with ❤️ for the Nigerian Judicial Service Committee**

**Version**: 1.0.0  
**Last Updated**: December 25, 2024