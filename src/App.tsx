import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { Toaster } from './components/ui/sonner';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { HRDashboardPage } from './pages/HRDashboardPage';
import { CashierDashboardPage } from './pages/CashierDashboardPage';
import { StaffListPage } from './pages/StaffListPage';
import { PayrollPage } from './pages/PayrollPage';
import { ArrearsPage } from './pages/ArrearsPage';
import { ApprovalsPageEnhanced } from './pages/ApprovalsPageEnhanced';
import { StaffRequestStatusPage } from './pages/staff/StaffRequestStatusPage';
import { AuditLogPage } from './pages/admin/AuditLogPage';
import { PayslipsPage } from './pages/PayslipsPage';
import { ReportsPage } from './pages/ReportsPage';
import { PayrollSetupPage } from './pages/PayrollSetupPage';
import { AdminPage } from './pages/AdminPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { StaffPortalPage } from './pages/StaffPortalPage';
import { LoanManagementPage } from './pages/LoanManagementPage';
import { DepartmentManagementPage } from './pages/DepartmentManagementPage';
import { StaffAllowancesPage } from './pages/StaffAllowancesPage';
import { LeaveManagementPage } from './pages/LeaveManagementPage';
import { BankPaymentsPage } from './pages/BankPaymentsPage';
import NotificationsPage from './pages/NotificationsPage';
import { CooperativeReportsPage } from './pages/CooperativeReportsPage';
import { CooperativeManagementPage } from './pages/CooperativeManagementPage';
import CustomReportBuilderPage from './pages/CustomReportBuilderPage';
import ReportsListPage from './pages/ReportsListPage';
import { SmtpSettingsPage } from './pages/SmtpSettingsPage';
import { TaxConfigurationPage } from './pages/admin/TaxConfigurationPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import StaffAdjustmentApprovalPage from './pages/StaffAdjustmentApprovalPage';
import StaffRequestsAdminPage from './pages/StaffRequestsAdminPage';
import { settingsAPI } from './lib/api-client';

function AppContent() {
  const { user, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'hr-dashboard' | 'cashier-dashboard' | 'staff' | 'staff-portal' | 'staff-request-status' | 'staff-requests' | 'payroll' | 'promotions' | 'arrears' | 'approvals' | 'payslips' | 'reports' | 'setup' | 'admin' | 'loan-management' | 'department-management' | 'staff-allowances' | 'staff-adjustment-approvals' | 'leave-management' | 'bank-payments' | 'notifications' | 'cooperative-reports' | 'cooperative-management' | 'custom-report-builder' | 'reports-list' | 'smtp-settings' | 'change-password' | 'audit-log' | 'tax-configuration'>('dashboard');

  // Set initial view based on user role
  useEffect(() => {
    if (user) {
      if (user.role === 'staff') {
        setCurrentView('staff-portal');
      } else if (user.role === 'hr_manager') {
        setCurrentView('hr-dashboard');
      } else if (user.role === 'cashier') {
        setCurrentView('cashier-dashboard');
      } else if (['reviewer', 'approver', 'auditor', 'audit'].includes(user.role)) {
        setCurrentView('approvals');
      }
    }
  }, [user]);

  // Listen for navigation events from Layout
  useEffect(() => {
    const handleNavigation = (event: CustomEvent) => {
      setCurrentView(event.detail.view);
    };

    window.addEventListener('navigate' as any, handleNavigation);
    return () => window.removeEventListener('navigate' as any, handleNavigation);
  }, []);

  // Create custom navigation helper
  useEffect(() => {
    (window as any).navigateTo = (view: string) => {
      setCurrentView(view as any);
    };
  }, []);

  useEffect(() => {
    const setFavicon = (href: string) => {
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = href;
    };

    const applyFavicon = async () => {
      try {
        const settings = await settingsAPI.getSettings({
          headers: { 'X-Skip-Auth-Handler': 'true' }
        });
        if (settings?.organization_logo) {
          setFavicon(settings.organization_logo);
        } else {
          setFavicon('/favicon.svg');
        }
      } catch {
        setFavicon('/favicon.svg');
      }
    };

    applyFavicon();
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading JSC Payroll System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout>
      {currentView === 'dashboard' && <DashboardPage />}
      {currentView === 'hr-dashboard' && <HRDashboardPage />}
      {currentView === 'cashier-dashboard' && <CashierDashboardPage />}
      {currentView === 'staff-portal' && <StaffPortalPage />}
      {currentView === 'staff-request-status' && <StaffRequestStatusPage />}
      {currentView === 'staff-requests' && <StaffRequestsAdminPage />}
      {currentView === 'staff' && <StaffListPage />}
      {currentView === 'payroll' && <PayrollPage />}
      {currentView === 'promotions' && <PromotionsPage />}
      {currentView === 'arrears' && <ArrearsPage />}
      {currentView === 'approvals' && <ApprovalsPageEnhanced />}
      {currentView === 'payslips' && <PayslipsPage />}
      {currentView === 'audit-log' && <AuditLogPage />}
      {currentView === 'reports' && <ReportsPage />}
      {currentView === 'setup' && <PayrollSetupPage />}
      {currentView === 'admin' && <AdminPage />}
      {currentView === 'loan-management' && <LoanManagementPage />}
      {currentView === 'department-management' && <DepartmentManagementPage />}
      {currentView === 'staff-allowances' && <StaffAllowancesPage />}
      {currentView === 'staff-adjustment-approvals' && <StaffAdjustmentApprovalPage />}
      {currentView === 'leave-management' && <LeaveManagementPage />}
      {currentView === 'bank-payments' && <BankPaymentsPage />}
      {currentView === 'notifications' && <NotificationsPage />}
      {currentView === 'cooperative-reports' && <CooperativeReportsPage />}
      {currentView === 'cooperative-management' && <CooperativeManagementPage />}
      {currentView === 'custom-report-builder' && <CustomReportBuilderPage />}
      {currentView === 'reports-list' && <ReportsListPage />}
      {currentView === 'smtp-settings' && <SmtpSettingsPage />}
      {currentView === 'tax-configuration' && <TaxConfigurationPage />}
      {currentView === 'change-password' && <ChangePasswordPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <Router>
      <ErrorBoundary>
          <ThemeProvider>
            <ToastProvider>
              <ConfirmProvider>
                <Routes>
                  {/* Public Routes - Password Recovery */}
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  
                  {/* Main App Route */}
                  <Route path="*" element={<AppContent />} />
                </Routes>
                <Toaster />
              </ConfirmProvider>
            </ToastProvider>
          </ThemeProvider>
      </ErrorBoundary>
    </Router>
  );
}
