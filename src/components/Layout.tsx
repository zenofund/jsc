import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { settingsAPI } from '../lib/api-client';
import { NotificationDropdown } from './NotificationDropdown';
import { 
  Menu, X, User, LogOut, Lock,
  LayoutDashboard, Users, DollarSign, 
  FileText, Settings, TrendingUp, CheckSquare,
  FolderOpen, BarChart3, Moon, Sun, Award, UserCircle, Wallet,
  ChevronDown, ChevronRight, Building2, Calendar, PlusCircle, Table,
  Mail
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";

interface LayoutProps {
  children: React.ReactNode;
}

interface NavigationGroup {
  group: string;
  items: NavigationItem[];
  roles: string[];
}

interface NavigationItem {
  name: string;
  icon: any;
  view: string;
  roles: string[];
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const networkStatus = useNetworkStatus();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [appVersion, setAppVersion] = useState<string>('JSCM v.1.0.1');
  const [approvalRoles, setApprovalRoles] = useState<string[]>(['approver', 'reviewer', 'auditor']); // Default fallback
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const installReminderMs = 8 * 60 * 60 * 1000;

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await settingsAPI.getSettings();
        if (settings) {
          if (settings.app_version) {
            setAppVersion(`JSCM v.${settings.app_version}`);
          }
          if (settings.approval_workflow && Array.isArray(settings.approval_workflow)) {
            const roles = settings.approval_workflow.map((stage: any) => stage.role);
            // Always include admin/auditor for oversight? Maybe not admin if they are not in workflow.
            // But let's stick to what's in the workflow as requested + maybe 'auditor' for viewing?
            // The request says: "Approval dashboard visibility exposed based on user roles defined in the approval workflow by the admin."
            // So we should strictly use those roles.
            // However, we should probably ensure unique roles.
            const uniqueRoles = Array.from(new Set(roles)) as string[];
            if (uniqueRoles.length > 0) {
              setApprovalRoles(uniqueRoles);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings', error);
      }
    };
    fetchSettings();
  }, []);

  React.useEffect(() => {
    const storedInstalled = localStorage.getItem('pwaInstalled') === 'true';
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    if (storedInstalled || isStandalone) {
      setIsInstalled(true);
    }

    const canShowPrompt = () => {
      const lastPrompt = Number(localStorage.getItem('pwaInstallPromptLastShown') || '0');
      return !isInstalled && !!deferredPrompt && Date.now() - lastPrompt >= installReminderMs;
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      const lastPrompt = Number(localStorage.getItem('pwaInstallPromptLastShown') || '0');
      if (!isInstalled && Date.now() - lastPrompt >= installReminderMs) {
        setShowInstallPrompt(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      localStorage.setItem('pwaInstalled', 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    const intervalId = window.setInterval(() => {
      if (canShowPrompt()) {
        setShowInstallPrompt(true);
      }
    }, 30 * 60 * 1000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.clearInterval(intervalId);
    };
  }, [deferredPrompt, isInstalled]);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    localStorage.setItem('pwaInstallPromptLastShown', Date.now().toString());
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
      localStorage.setItem('pwaInstalled', 'true');
    }
    setShowInstallPrompt(false);
    setDeferredPrompt(null);
  };

  const handleDismissInstall = () => {
    localStorage.setItem('pwaInstallPromptLastShown', Date.now().toString());
    setShowInstallPrompt(false);
  };

  const navigationGroups: NavigationGroup[] = [
    {
      group: 'Human Resources',
      roles: ['admin', 'payroll_officer', 'hr_manager'],
      items: [
        { name: 'Staff Management', icon: Users, view: 'staff', roles: ['admin', 'payroll_officer', 'hr_manager'] },
        { name: 'Staff Requests', icon: CheckSquare, view: 'staff-requests', roles: ['admin', 'hr_manager'] },
        { name: 'Leave Management', icon: Calendar, view: 'leave-management', roles: ['admin', 'payroll_officer', 'hr_manager'] },
        { name: 'Department Management', icon: Building2, view: 'department-management', roles: ['admin', 'payroll_officer', 'hr_manager'] },
        { name: 'Promotions', icon: Award, view: 'promotions', roles: ['admin', 'payroll_officer', 'hr_manager'] },
      ],
    },
    {
      group: 'Payroll Operations',
      roles: ['admin', 'payroll_officer', 'approver', 'reviewer', 'auditor', 'payroll_loader'],
      items: [
        { name: 'Payroll Processing', icon: DollarSign, view: 'payroll', roles: ['admin', 'payroll_officer', 'approver', 'reviewer', 'auditor', 'payroll_loader'] },
        { name: 'Staff Adjustments', icon: TrendingUp, view: 'staff-allowances', roles: ['admin', 'payroll_officer', 'payroll_loader'] },
        { name: 'Adjustment Approvals', icon: CheckSquare, view: 'staff-adjustment-approvals', roles: ['admin', 'payroll_officer'] },
        { name: 'Arrears & Adjustments', icon: TrendingUp, view: 'arrears', roles: ['admin', 'payroll_officer', 'payroll_loader'] },
        { name: 'Payslips', icon: FileText, view: 'payslips', roles: ['*'] },
      ],
    },
    {
      group: 'Financial Services',
      roles: ['admin', 'payroll_officer', 'cashier'],
      items: [
        { name: 'Loan Management', icon: Wallet, view: 'loan-management', roles: ['admin', 'payroll_officer'] },
        { name: 'Cooperative Management', icon: Users, view: 'cooperative-management', roles: ['admin', 'payroll_officer'] },
        { name: 'Cooperative Reports', icon: Building2, view: 'cooperative-reports', roles: ['admin', 'payroll_officer'] },
        { name: 'Bank Payments', icon: Building2, view: 'bank-payments', roles: ['admin', 'payroll_officer', 'cashier'] },
      ],
    },
    {
      group: 'Reporting & Analytics',
      roles: ['admin', 'payroll_officer', 'hr_manager'],
      items: [
        { name: 'Reports', icon: BarChart3, view: 'reports', roles: ['admin', 'payroll_officer', 'hr_manager'] },
        { name: 'Custom Reports', icon: Table, view: 'reports-list', roles: ['admin', 'payroll_officer', 'hr_manager'] },
        { name: 'Report Builder', icon: PlusCircle, view: 'custom-report-builder', roles: ['admin', 'payroll_officer', 'hr_manager'] },
      ],
    },
    {
      group: 'Config & Settings',
      roles: ['admin', 'payroll_officer'],
      items: [
        { name: 'Payroll Setup', icon: FolderOpen, view: 'setup', roles: ['admin', 'payroll_officer'] },
        { name: 'System Admin', icon: Settings, view: 'admin', roles: ['admin'] },
        { name: 'Tax Configuration', icon: DollarSign, view: 'tax-configuration', roles: ['admin'] },
        { name: 'SMTP Settings', icon: Mail, view: 'smtp-settings', roles: ['admin'] },
        { name: 'Audit Log', icon: FileText, view: 'audit-log', roles: ['admin'] },
      ],
    },
  ];

  const standaloneNavigation = [
    { name: 'Dashboard', icon: LayoutDashboard, view: 'dashboard', roles: ['admin', 'payroll_officer', 'hr_manager', 'approver', 'reviewer', 'auditor', 'cashier', 'payroll_loader'] },
    { name: 'Staff Portal', icon: UserCircle, view: 'staff-portal', roles: ['staff'] },
    { name: 'My Requests', icon: FileText, view: 'staff-request-status', roles: ['staff'] },
    { name: 'Approvals', icon: CheckSquare, view: 'approvals', roles: approvalRoles },
  ];

  const hasAccess = (allowedRoles: string[]) => {
    if (allowedRoles.includes('*')) return true;
    return user && allowedRoles.includes(user.role);
  };

  const hasGroupAccess = (group: NavigationGroup) => {
    // Check if user has access to any item in the group
    return group.items.some(item => hasAccess(item.roles));
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupName)
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    );
  };

  const handleNavigate = (view: string) => {
    // Handle special route for notifications
    if (view === '/notifications') {
      (window as any).navigateTo?.('notifications');
    } else {
      (window as any).navigateTo?.(view);
    }
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Online': return 'text-green-600 dark:text-green-500';
      case 'Offline': return 'text-red-600 dark:text-red-500';
      case 'Slow': return 'text-yellow-600 dark:text-yellow-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="bg-card border-b border-border fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between px-3 sm:px-4 h-14 sm:h-16">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-accent rounded-lg flex-shrink-0"
            >
              {sidebarOpen ? <X className="w-5 h-5 text-muted-foreground" /> : <Menu className="w-5 h-5 text-muted-foreground" />}
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-semibold text-foreground text-sm sm:text-base truncate">
                <span className="hidden sm:inline">JSC Payroll Management System</span>
                <span className="sm:hidden">JSC-PMS</span>
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Judicial Service Committee</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 hover:bg-accent rounded-lg flex-shrink-0"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              ) : (
                <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              )}
            </button>
            
            <NotificationDropdown onNavigate={handleNavigate} />
            
            <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-border">
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-foreground">{user?.full_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{(user?.role ? user.role : '').replace('_', ' ')}</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-600 dark:bg-green-700 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{user?.full_name}</p>
                </TooltipContent>
              </Tooltip>
              <button
                onClick={logout}
                className="p-2 hover:bg-accent rounded-lg hidden sm:block"
                title="Logout"
              >
                <LogOut className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Overlay - Covers entire viewport including banner and header */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 top-0 bg-white/10 backdrop-blur-sm z-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-64 sm:w-72 lg:w-64 bg-card border-r border-border transition-transform duration-300 z-[60] lg:z-20 lg:top-14 lg:sm:top-16 shadow-2xl lg:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Header - Only visible on mobile when sidebar is open */}
        <div className="lg:hidden flex items-center justify-between px-4 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-600 dark:bg-green-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">JSC</span>
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">JSC-PMS</h2>
              <p className="text-xs text-muted-foreground">Payroll System</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 hover:bg-accent rounded-lg flex-shrink-0"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 px-3 sm:px-4 py-4 sm:py-6 space-y-1 sm:space-y-2 overflow-y-auto h-[calc(100%-80px)] lg:h-[calc(100%-80px)]">
          {standaloneNavigation.map((item) => {
            if (!hasAccess(item.roles)) return null;
            const Icon = item.icon;
            
            return (
              <button
                key={item.view}
                onClick={() => handleNavigate(item.view)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm text-foreground hover:bg-accent active:bg-accent`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="whitespace-nowrap">{item.name}</span>
              </button>
            );
          })}

          {navigationGroups.map((group) => {
            if (!hasGroupAccess(group)) return null;
            
            return (
              <div key={group.group}>
                <button
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm text-foreground hover:bg-accent active:bg-accent`}
                  onClick={() => toggleGroup(group.group)}
                >
                  <ChevronDown className={`w-4 h-4 flex-shrink-0 ${expandedGroups.includes(group.group) ? 'rotate-180' : ''}`} />
                  <span className="whitespace-nowrap">{group.group}</span>
                </button>
                {expandedGroups.includes(group.group) && (
                  <div className="pl-5">
                    {group.items.map((item) => {
                      if (!hasAccess(item.roles)) return null;
                      const Icon = item.icon;
                      
                      return (
                        <button
                          key={item.view}
                          onClick={() => handleNavigate(item.view)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm text-foreground hover:bg-accent active:bg-accent`}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="whitespace-nowrap">{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Mobile Logout Button */}
          <div className="mt-4 border-t border-border pt-4 space-y-1">
            <button
              onClick={() => handleNavigate('change-password')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm text-foreground hover:bg-accent active:bg-accent"
            >
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span className="whitespace-nowrap">Change Password</span>
            </button>
            
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm text-red-600 dark:text-red-500 hover:bg-red-50 active:bg-red-100 sm:hidden"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span className="whitespace-nowrap">Logout</span>
            </button>
          </div>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 border-t border-border bg-muted">
          <div className="text-xs text-muted-foreground">
            <p>System Status: <span className={`${getStatusColor(networkStatus)} font-medium`}>{networkStatus}</span></p>
            <p className="mt-1">{appVersion}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`pt-14 sm:pt-16 transition-all duration-300 ${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
        }`}
      >
        <div className="p-3 sm:p-4 md:p-6">
          {children}
        </div>
      </main>
      {showInstallPrompt && !isInstalled && (
        <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">Install JSC PMS</div>
                <div className="text-xs text-muted-foreground">
                  Get faster access and an app-like experience.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDismissInstall}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Not now
                </button>
                <button
                  onClick={handleInstallApp}
                  className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  Install
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
