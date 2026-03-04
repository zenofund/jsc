import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { 
  payrollAPI, 
  loanApplicationAPI, 
  staffPortalAPI,
  arrearsAPI,
  promotionAPI,
  paymentBatchAPI,
  leaveAPI,
  staffAPI,
  payslipAPI,
  notificationAPI
} from '../lib/api-client';
import { NotificationIntegration } from '../lib/notification-integration';
import { loanApplicationAPI as loanAPI, loanTypeAPI, disbursementAPI, guarantorAPI, cooperativeAPI } from '../lib/loanAPI';
import { CooperativeMembershipCard } from '../components/CooperativeMembershipCard';
import { PageSkeleton } from '../components/PageLoader';
import type { CooperativeMember, Cooperative, CooperativeContribution } from '../types/entities';
import { 
  User, FileText, Calendar, CreditCard, Award, Settings, 
  Edit, Download, Send, CheckCircle, XCircle, Clock, 
  Phone, Mail, MapPin, Building, Briefcase, DollarSign,
  TrendingUp, Users, Eye, EyeOff, Plus, X, Check, LayoutDashboard, Wallet, Building2, Loader2
} from 'lucide-react';

type TabType = 'dashboard' | 'profile' | 'payslips' | 'promotions' | 'leave' | 'requests' | 'documents' | 'loans' | 'cooperatives' | 'settings';

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { formatCurrency } from '../utils/format';
import { PayslipTemplate } from '../components/PayslipTemplate';
import { generatePayslipPDF } from '../utils/payslipGenerator';
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

// Initialize vfs for pdfmake
if (pdfFonts && (pdfFonts as any).pdfMake) {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
}

export function StaffPortalPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  
  // Dashboard data
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  
  // Leave data
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'annual' as any,
    start_date: '',
    end_date: '',
    reason: '',
    relief_officer: '',
  });
  
  // Staff requests data
  const [staffRequests, setStaffRequests] = useState<any[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState<'contact_update' | 'bank_update' | 'nok_update' | 'salary_certificate' | 'employment_verification'>('contact_update');
  const [requestForm, setRequestForm] = useState<any>({});
  
  // Documents
  const [documents, setDocuments] = useState<any[]>([]);
  
  // Payslips
  const [payslips, setPayslips] = useState<any[]>([]);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => setPushEnabled(!!subscription));
    }
  }, []);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  
  // Promotions
  const [promotions, setPromotions] = useState<any[]>([]);
  
  // Loans
  const [loanApplications, setLoanApplications] = useState<any[]>([]);
  const [loanTypes, setLoanTypes] = useState<any[]>([]);
  const [myLoans, setMyLoans] = useState<any[]>([]);
  const [guarantorRequests, setGuarantorRequests] = useState<any[]>([]);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanForm, setLoanForm] = useState({
    loan_type_id: '',
    amount_requested: 0,
    purpose: '',
    tenure_months: 12,
    guarantors: [] as string[],
    cooperative_id: '', // Added for cooperative selection
  });
  
  // Cooperatives
  const [myCooperatives, setMyCooperatives] = useState<CooperativeMember[]>([]);
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [selectedCooperativeId, setSelectedCooperativeId] = useState<string>('');
  const [cooperativeContributions, setCooperativeContributions] = useState<CooperativeContribution[]>([]);
  const [cooperativeLoans, setCooperativeLoans] = useState<any[]>([]);
  
  // Profile edit
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.staff_id) {
      showToast('error', 'No staff profile linked to your account');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Load dashboard stats
      try {
        const stats = await staffPortalAPI.getStaffDashboardStats(user.staff_id);
        setDashboardStats(stats);
        
        // Set profile form
        if (stats?.staff) {
          setProfileForm({
            phone: stats.staff.bio_data.phone || '',
            email: stats.staff.bio_data.email || '',
            address: stats.staff.bio_data.address || '',
          });
        }
      } catch (error) {
        console.error('Dashboard stats error:', error);
        showToast('error', 'Failed to load dashboard statistics');
      }
      
      // Load leave requests
      try {
        const leavesRes = await staffPortalAPI.getStaffLeaveRequests(user.staff_id);
        const leavesData = Array.isArray(leavesRes) ? leavesRes : (leavesRes?.data || []);
        setLeaveRequests(Array.isArray(leavesData) ? leavesData : []);
      } catch (error) {
        console.error('Leave requests error:', error);
      }
      
      // Load staff requests
      try {
        const requests = await staffPortalAPI.getStaffRequests(user.staff_id);
        setStaffRequests(requests);
      } catch (error) {
        console.error('Staff requests error:', error);
      }
      
      // Load documents
      try {
        const docs = await staffPortalAPI.getStaffDocuments(user.staff_id);
        setDocuments(docs);
      } catch (error) {
        console.error('Documents error:', error);
      }
      
      // Load payslips
      try {
        const slips = await payslipAPI.getStaffPayslips(user.staff_id);
        const mappedSlips = (Array.isArray(slips) ? slips : []).map(item => ({
          line: item,
          batch: {
            month: item.payroll_month,
            batch_number: item.batch_number,
            status: item.batch_status
          }
        }));
        setPayslips(mappedSlips);
      } catch (error) {
        console.error('Payslips error:', error);
      }
      
      // Load promotions
      try {
        const promos = await promotionAPI.getStaffPromotions(user.staff_id);
        setPromotions(promos);
      } catch (error) {
        console.error('Promotions error:', error);
      }
      
      // Load loan data
      try {
        const [apps, types, disbs, guarantors] = await Promise.all([
          loanApplicationAPI.getAll({ staff_id: user.staff_id }),
          loanTypeAPI.getAll({ status: 'active' }),
          disbursementAPI.getAll({ staff_id: user.staff_id }),
          guarantorAPI.getMyGuarantorRequests(user.staff_id),
        ]);
        setLoanApplications(apps);
        setLoanTypes(types);
        setMyLoans(disbs);
        setGuarantorRequests(guarantors);
      } catch (error) {
        console.error('Loans error:', error);
      }
      
      // Load cooperative data
      try {
        const [memberships, allCoops] = await Promise.all([
          cooperativeAPI.getMembershipsByStaffId(user.staff_id),
          cooperativeAPI.getAll({ status: 'active' }),
        ]);
        setMyCooperatives(memberships);
        setCooperatives(allCoops);
        
        // Load contributions if user has memberships
        if (memberships.length > 0) {
          const contributions = await cooperativeAPI.getContributions({ staff_id: user.staff_id });
          setCooperativeContributions(contributions);
        }
      } catch (error) {
        console.error('Cooperatives error:', error);
      }
    } catch (error) {
      console.error('General error:', error);
      showToast('error', 'Failed to load staff portal data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLeaveRequest = async () => {
    if (!user?.staff_id) return;
    
    setIsSubmitting(true);
    try {
      // Calculate days requested
      const start = new Date(leaveForm.start_date);
      const end = new Date(leaveForm.end_date);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const typesRes = await leaveAPI.getLeaveTypes();
      const types = Array.isArray(typesRes) ? typesRes : (typesRes?.data || []);
      let leaveTypeId = '';
      if (leaveForm.leave_type && typeof leaveForm.leave_type === 'string' && leaveForm.leave_type.includes('-') && leaveForm.leave_type.length >= 32) {
        leaveTypeId = leaveForm.leave_type;
      } else {
        const normalized = String(leaveForm.leave_type || '').toLowerCase();
        const matched = (types || []).find((t: any) => String(t.name || '').toLowerCase().includes(normalized || 'annual'));
        leaveTypeId = matched?.id || (types[0]?.id || '');
      }
      const payload = {
        staffId: user.staff_id,
        leaveTypeId,
        startDate: leaveForm.start_date,
        endDate: leaveForm.end_date,
        reason: leaveForm.reason,
        reliefOfficerStaffId: leaveForm.relief_officer || undefined,
      };
      await staffPortalAPI.createLeaveRequest(payload);
      
      // Send system notification to requester
      await NotificationIntegration.sendSystemNotification(
        'Leave Request Submitted',
        `Your leave request for ${days} days has been submitted successfully.`,
        'success'
      );

      showToast('success', 'Leave request submitted successfully');
      setShowLeaveModal(false);
      setLeaveForm({
        leave_type: 'annual',
        start_date: '',
        end_date: '',
        reason: '',
        relief_officer: '',
      });
      loadData();
    } catch (error) {
      showToast('error', 'Failed to submit leave request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    if (!user?.staff_id) return;
    
    setProcessingId(leaveId);
    try {
      await staffPortalAPI.cancelLeaveRequest(leaveId, user.staff_id);
      
      // Send system notification
      await NotificationIntegration.sendSystemNotification(
        'Leave Request Cancelled',
        'Your leave request has been cancelled successfully.',
        'info'
      );

      showToast('success', 'Leave request cancelled');
      loadData();
    } catch (error) {
      showToast('error', 'Failed to cancel leave request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateStaffRequest = async () => {
    if (!user?.staff_id) return;
    
    setIsSubmitting(true);
    try {
      await staffPortalAPI.createStaffRequest({
        staff_id: user.staff_id,
        request_type: requestType,
        details: requestForm,
      });
      
      // Send system notification
      await NotificationIntegration.sendSystemNotification(
        'Request Submitted',
        `Your ${requestType.replace(/_/g, ' ')} request has been submitted.`,
        'success'
      );

      showToast('success', 'Request submitted successfully');
      setShowRequestModal(false);
      setRequestForm({});
      loadData();
    } catch (error) {
      showToast('error', 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user?.staff_id) return;
    
    try {
      await staffPortalAPI.updateStaffProfile(user.staff_id, profileForm);
      
      // Send system notification
      await NotificationIntegration.sendSystemNotification(
        'Profile Updated',
        'Your profile information has been updated successfully.',
        'success'
      );

      showToast('success', 'Profile updated successfully');
      setIsEditingProfile(false);
      loadData();
    } catch (error) {
      showToast('error', 'Failed to update profile');
    }
  };

  const renderDashboard = () => {
    if (!dashboardStats) return null;

    const { staff, current_salary, grade_level, step, years_of_service, department, designation, leave_balance, recent_payslips, pending_requests, promotion_history, next_payday } = dashboardStats;
    const first = staff?.bio_data.first_name || '';
    const last = staff?.bio_data.last_name || '';
    const initials = (first.charAt(0) + (last.charAt(0) || '')).toUpperCase();

    // Prepare chart data from payslips state (which has more detail)
    const chartData = [...payslips]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-6) // Last 6 months
      .map(p => ({
        month: p.batch?.month || 'Unknown',
        net_pay: p.line?.net_pay || 0,
        gross_pay: p.line?.gross_pay || 0,
      }));

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Welcome Card with Modern Gradient */}
        <div className="md:hidden mb-4 px-2">
          <h2 className="text-2xl font-bold">Welcome, {staff?.bio_data.first_name}!</h2>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 via-green-700 to-teal-800 text-white shadow-xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-black/10 rounded-full blur-2xl"></div>
          
          <div className="relative p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="p-1 bg-white/20 rounded-full backdrop-blur-sm">
                <div className="bg-white/90 text-green-700 w-12 h-12 rounded-full shadow-lg flex items-center justify-center font-bold">
                  {initials || (first.charAt(0).toUpperCase())}
                </div>
              </div>
              <div>
                <h2 className="hidden md:block text-3xl font-bold mb-1">Welcome, {staff?.bio_data.first_name}!</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-green-100/90 text-sm font-medium">
                  <span className="flex items-center gap-1.5">
                    <Building className="h-4 w-4" />
                    {department}
                  </span>
                  <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" />
                    {designation}
                  </span>
                  <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                  <span>ID: {staff?.staff_number}</span>
                </div>
                {/* Contact Info Row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-green-100/80 text-xs mt-2">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    {staff.bio_data.email}
                  </span>
                  {staff.bio_data.phone && (
                    <>
                      <span className="hidden sm:inline w-1 h-1 bg-green-400 rounded-full"></span>
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        {staff.bio_data.phone}
                      </span>
                    </>
                  )}
                  {staff.bio_data.address && (
                    <>
                      <span className="hidden sm:inline w-1 h-1 bg-green-400 rounded-full"></span>
                      <span className="flex items-center gap-1.5 max-w-[200px] truncate" title={staff.bio_data.address}>
                        <MapPin className="h-3 w-3" />
                        {staff.bio_data.address}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="hidden md:flex gap-3 w-full md:w-auto">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex-1 md:min-w-[140px] border border-white/10">
                <p className="text-green-100 text-xs uppercase tracking-wider font-semibold mb-1">Next Payday</p>
                <p className="text-xl font-bold">
                  {next_payday 
                    ? new Date(next_payday).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    : `25th ${new Date().toLocaleString('default', { month: 'short' })}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid - Floating Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-card hover:bg-accent/5 transition-colors rounded-xl p-6 border border-border shadow-sm hover:shadow-md group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
              <DollarSign className="h-24 w-24 text-green-600" />
            </div>
            <div className="relative z-10">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 w-fit rounded-lg mb-4 text-green-600 dark:text-green-400">
                <DollarSign className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Current Salary</p>
              <p className="text-2xl font-bold text-card-foreground mt-1">{formatCurrency(current_salary)}</p>
            </div>
          </div>

          <div className="bg-card hover:bg-accent/5 transition-colors rounded-xl p-6 border border-border shadow-sm hover:shadow-md group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
              <TrendingUp className="h-24 w-24 text-blue-600" />
            </div>
            <div className="relative z-10">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 w-fit rounded-lg mb-4 text-blue-600 dark:text-blue-400">
                <TrendingUp className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Grade Level</p>
              <p className="text-2xl font-bold text-card-foreground mt-1">GL {grade_level} <span className="text-lg font-normal text-muted-foreground">Step {step}</span></p>
            </div>
          </div>

          <div className="bg-card hover:bg-accent/5 transition-colors rounded-xl p-6 border border-border shadow-sm hover:shadow-md group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
              <Award className="h-24 w-24 text-purple-600" />
            </div>
            <div className="relative z-10">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 w-fit rounded-lg mb-4 text-purple-600 dark:text-purple-400">
                <Award className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Service Years</p>
              <p className="text-2xl font-bold text-card-foreground mt-1">{years_of_service} <span className="text-base font-normal text-muted-foreground">Years</span></p>
            </div>
          </div>

          <div className="bg-card hover:bg-accent/5 transition-colors rounded-xl p-6 border border-border shadow-sm hover:shadow-md group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
              <Calendar className="h-24 w-24 text-orange-600" />
            </div>
            <div className="relative z-10">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 w-fit rounded-lg mb-4 text-orange-600 dark:text-orange-400">
                <Calendar className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Leave Balance</p>
              <p className="text-2xl font-bold text-card-foreground mt-1">{leave_balance.total} <span className="text-base font-normal text-muted-foreground">Days</span></p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Column (2/3) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Salary History Chart */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-card-foreground">Salary History</h3>
                  <p className="text-sm text-muted-foreground">Net pay trend over the last 6 months</p>
                </div>
                <button onClick={() => setActiveTab('payslips')} className="text-sm text-primary hover:underline">View All</button>
              </div>
              
              <div className="h-[300px] w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorNetPay" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-gray-700" />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6b7280', fontSize: 12 }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#6b7280', fontSize: 12 }} 
                        tickFormatter={(value) => formatCurrency(Number(value))}
                      />
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--background)', 
                          borderColor: 'var(--border)', 
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                        formatter={(value: any) => [formatCurrency(Number(value)), 'Net Pay']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="net_pay" 
                        stroke="#16a34a" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorNetPay)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border">
                    <TrendingUp className="h-10 w-10 mb-2 opacity-50" />
                    <p>No salary history available yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <button
                  onClick={() => { setActiveTab('leave'); setShowLeaveModal(true); }}
                  className="flex flex-col items-center justify-center p-6 bg-card hover:bg-green-50 dark:hover:bg-green-900/10 border border-border hover:border-green-200 dark:hover:border-green-800 rounded-xl shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full mb-3 group-hover:scale-110 transition-transform">
                    <Calendar className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm font-medium text-card-foreground">Request Leave</span>
                </button>

                <button
                  onClick={() => setActiveTab('payslips')}
                  className="flex flex-col items-center justify-center p-6 bg-card hover:bg-blue-50 dark:hover:bg-blue-900/10 border border-border hover:border-blue-200 dark:hover:border-blue-800 rounded-xl shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-3 group-hover:scale-110 transition-transform">
                    <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-card-foreground">Payslips</span>
                </button>

                <button
                  onClick={() => { setActiveTab('requests'); setShowRequestModal(true); }}
                  className="flex flex-col items-center justify-center p-6 bg-card hover:bg-orange-50 dark:hover:bg-orange-900/10 border border-border hover:border-orange-200 dark:hover:border-orange-800 rounded-xl shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full mb-3 group-hover:scale-110 transition-transform">
                    <Send className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="text-sm font-medium text-card-foreground">New Request</span>
                </button>

                <button
                  onClick={() => setActiveTab('loans')}
                  className="flex flex-col items-center justify-center p-6 bg-card hover:bg-purple-50 dark:hover:bg-purple-900/10 border border-border hover:border-purple-200 dark:hover:border-purple-800 rounded-xl shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-3 group-hover:scale-110 transition-transform">
                    <Wallet className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-sm font-medium text-card-foreground">Loans</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar Column (1/3) */}
          <div className="space-y-8">
            {/* Notifications / Pending */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Pending Actions
              </h3>
              
              <div className="space-y-3">
                {pending_requests.leave > 0 || pending_requests.self_service > 0 ? (
                  <>
                    {pending_requests.leave > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-card-foreground">{pending_requests.leave} Leave Request{pending_requests.leave > 1 ? 's' : ''}</p>
                          <p className="text-xs text-muted-foreground">Awaiting approval</p>
                        </div>
                        <button onClick={() => setActiveTab('leave')} className="text-xs font-medium text-yellow-700 hover:underline">View</button>
                      </div>
                    )}
                    {pending_requests.self_service > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-card-foreground">{pending_requests.self_service} Service Request{pending_requests.self_service > 1 ? 's' : ''}</p>
                          <p className="text-xs text-muted-foreground">In progress</p>
                        </div>
                        <button onClick={() => setActiveTab('requests')} className="text-xs font-medium text-blue-700 hover:underline">View</button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500/50" />
                    <p>You're all caught up!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Summary Tiny */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-card-foreground">My Profile</h3>
                <button onClick={() => setActiveTab('profile')} className="p-1 hover:bg-secondary rounded-full">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-secondary p-2 rounded-lg">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground text-xs">Address</p>
                    <p className="text-card-foreground line-clamp-1">{staff.bio_data.address}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="bg-secondary p-2 rounded-lg">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground text-xs">Phone</p>
                    <p className="text-card-foreground">{staff.bio_data.phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-secondary p-2 rounded-lg">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground text-xs">Email</p>
                    <p className="text-card-foreground truncate">{staff.bio_data.email}</p>
                  </div>
                </div>
              </div>
              

            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProfile = () => {
    if (!dashboardStats?.staff) return null;

    const staff = dashboardStats.staff;

    return (
      <div className="space-y-6">
        {/* Bio Data */}
        <div className="bg-card rounded-lg p-4 sm:p-6 border border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h3 className="text-lg text-card-foreground font-semibold">Personal Information</h3>
            {!isEditingProfile ? (
              <button
                onClick={() => setIsEditingProfile(true)}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 w-full sm:w-auto transition-colors"
              >
                <Edit className="h-4 w-4" />
                Edit Contact
              </button>
            ) : (
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={handleUpdateProfile}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditingProfile(false);
                    setProfileForm({
                      phone: staff.bio_data.phone,
                      email: staff.bio_data.email,
                      address: staff.bio_data.address,
                    });
                  }}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Full Name</p>
              <p className="text-card-foreground font-medium">{staff.bio_data.first_name} {staff.bio_data.middle_name} {staff.bio_data.last_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Staff Number</p>
              <p className="text-card-foreground font-medium">{staff.staff_number}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Date of Birth</p>
              <p className="text-card-foreground font-medium">{new Date(staff.bio_data.date_of_birth).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Gender</p>
              <p className="text-card-foreground font-medium capitalize">{staff.bio_data.gender}</p>
            </div>
            
            {/* Editable Fields */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Phone Number</p>
              {isEditingProfile ? (
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-card text-card-foreground focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <p className="text-card-foreground font-medium">{staff.bio_data.phone}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Email</p>
              {isEditingProfile ? (
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-card text-card-foreground focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <p className="text-card-foreground font-medium break-all">{staff.bio_data.email}</p>
                </div>
              )}
            </div>
            
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground mb-1">Address</p>
              {isEditingProfile ? (
                <textarea
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-md bg-card text-card-foreground focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                />
              ) : (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                  <p className="text-card-foreground font-medium">{staff.bio_data.address}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">State of Origin</p>
              <p className="text-card-foreground font-medium">{staff.bio_data.state_of_origin}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">LGA of Origin</p>
              <p className="text-card-foreground font-medium">{staff.bio_data.lga_of_origin}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Marital Status</p>
              <p className="text-card-foreground font-medium capitalize">{staff.bio_data.marital_status}</p>
            </div>
          </div>
        </div>

        {/* Appointment Details */}
        <div className="bg-card rounded-lg p-4 sm:p-6 border border-border">
          <h3 className="text-lg mb-4 text-card-foreground font-semibold border-b border-border pb-2">Appointment Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Date of First Appointment</p>
              <p className="text-card-foreground font-medium">{new Date(staff.appointment.date_of_first_appointment).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Posting</p>
              <p className="text-card-foreground font-medium">{staff.appointment.current_posting}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Department</p>
              <p className="text-card-foreground font-medium">{staff.appointment.department}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Designation</p>
              <p className="text-card-foreground font-medium">{staff.appointment.designation}</p>
            </div>
          </div>
        </div>

        {/* Salary Info */}
        <div className="bg-card rounded-lg p-4 sm:p-6 border border-border">
          <h3 className="text-lg mb-4 text-card-foreground font-semibold border-b border-border pb-2">Salary Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Grade Level</p>
              <p className="text-card-foreground font-medium">Grade Level {staff.salary_info.grade_level}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Step</p>
              <p className="text-card-foreground font-medium">Step {staff.salary_info.step}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Bank Name</p>
              <p className="text-card-foreground font-medium">{staff.salary_info.bank_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Account Number</p>
              <p className="text-card-foreground font-medium">{staff.salary_info.account_number}</p>
            </div>
          </div>
        </div>

        {/* Next of Kin */}
        <div className="bg-card rounded-lg p-4 sm:p-6 border border-border">
          <h3 className="text-lg mb-4 text-card-foreground font-semibold border-b border-border pb-2">Next of Kin</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Name</p>
              <p className="text-card-foreground font-medium">{staff.next_of_kin.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Relationship</p>
              <p className="text-card-foreground font-medium">{staff.next_of_kin.relationship}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Phone</p>
              <p className="text-card-foreground font-medium">{staff.next_of_kin.phone}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground mb-1">Address</p>
              <p className="text-card-foreground font-medium">{staff.next_of_kin.address}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleDownloadPayslip = (payslip: any) => {
    try {
      const docDefinition = generatePayslipPDF(payslip, user);
      
      // Construct personalized filename
      const month = payslip.batch?.month || payslip.line?.payroll_month || 'Unknown';
      const staffName = (payslip.line?.staff_name || user?.email || 'Staff').replace(/\s+/g, '_');
      const staffNumber = payslip.line?.staff_number || 'NoID';
      const filename = `Payslip_${month}_${staffName}_${staffNumber}.pdf`;

      pdfMake.createPdf(docDefinition).download(filename);
      showToast('success', 'Payslip downloaded successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      showToast('error', 'Failed to generate PDF');
    }
  };

  const renderPayslips = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg text-card-foreground">My Payslips</h3>
          <p className="text-sm text-muted-foreground">{payslips.length} Payslip(s)</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {payslips.length > 0 ? (
            payslips.map((payslip, index) => (
              <div key={payslip.line?.id || index} className="bg-card rounded-lg p-4 border border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
                      <FileText className="h-6 w-6 text-green-600 dark:text-green-500" />
                    </div>
                    <div>
                      <p className="text-card-foreground font-medium">Payslip - {payslip.batch?.month}</p>
                      <p className="text-sm text-muted-foreground">Batch: {payslip.batch?.batch_number}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:items-end gap-2 sm:gap-0 w-full sm:w-auto">
                    <p className="text-lg font-bold text-card-foreground">{formatCurrency(payslip.line?.net_pay)}</p>
                    <div className="flex gap-2 mt-2 w-full sm:w-auto">
                      <button
                        onClick={() => {
                          setSelectedPayslip(payslip);
                          setShowPayslipModal(true);
                        }}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                      <button 
                        onClick={() => handleDownloadPayslip(payslip)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-card rounded-lg p-8 border border-border text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-muted-foreground">No payslips available yet</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPromotions = () => {
    const approvedPromotions = promotions.filter(p => p.status === 'approved');
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg text-card-foreground">My Promotion History</h3>
          <p className="text-sm text-muted-foreground">{approvedPromotions.length} Promotion(s)</p>
        </div>

        <div className="space-y-3">
          {approvedPromotions.length > 0 ? (
            approvedPromotions.map((promotion) => (
              <div key={promotion.id} className="bg-card rounded-lg p-4 border border-border">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-2">
                      <Award className="h-5 w-5 text-purple-600 dark:text-purple-500" />
                    </div>
                    <div>
                      <p className="text-card-foreground">GL {promotion.old_grade_level} Step {promotion.old_step} → GL {promotion.new_grade_level} Step {promotion.new_step}</p>
                      <p className="text-sm text-muted-foreground">Effective: {new Date(promotion.effective_date).toLocaleDateString()}</p>
                      {promotion.approval_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Approved: {new Date(promotion.approval_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                    Approved
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-card rounded-lg p-8 border border-border text-center">
              <Award className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-muted-foreground">No promotion history</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLeave = () => {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg text-card-foreground">Leave Management</h3>
          <button
            onClick={() => setShowLeaveModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Request Leave
          </button>
        </div>

        {/* Leave Balance */}
        {dashboardStats?.leave_balance && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-blue-900 dark:text-blue-200 mb-1">Annual</p>
              <p className="text-xl sm:text-2xl font-semibold text-blue-700 dark:text-blue-300">{dashboardStats.leave_balance.annual} <span className="text-xs sm:text-sm font-normal">Days</span></p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-green-900 dark:text-green-200 mb-1">Sick</p>
              <p className="text-xl sm:text-2xl font-semibold text-green-700 dark:text-green-300">{dashboardStats.leave_balance.sick} <span className="text-xs sm:text-sm font-normal">Days</span></p>
            </div>
            <div className="bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-pink-900 dark:text-pink-200 mb-1">Maternity</p>
              <p className="text-xl sm:text-2xl font-semibold text-pink-700 dark:text-pink-300">{dashboardStats.leave_balance.maternity} <span className="text-xs sm:text-sm font-normal">Days</span></p>
            </div>
            <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-sky-900 dark:text-sky-200 mb-1">Paternity</p>
              <p className="text-xl sm:text-2xl font-semibold text-sky-700 dark:text-sky-300">{dashboardStats.leave_balance.paternity} <span className="text-xs sm:text-sm font-normal">Days</span></p>
            </div>
            <div className="col-span-2 md:col-span-1 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-purple-900 dark:text-purple-200 mb-1">Total</p>
              <p className="text-xl sm:text-2xl font-semibold text-purple-700 dark:text-purple-300">{dashboardStats.leave_balance.total} <span className="text-xs sm:text-sm font-normal">Days</span></p>
            </div>
          </div>
        )}

        {/* Leave Requests */}
        <div className="space-y-3">
          {leaveRequests.length > 0 ? (
            leaveRequests.map((leave) => (
              <div key={leave.id} className="bg-card rounded-lg p-4 border border-border">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2 flex-shrink-0">
                      <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                    </div>
                    <div>
                      <p className="text-card-foreground font-medium capitalize">{leave.leave_type} Leave</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground">{leave.number_of_days} Days</p>
                      {leave.reason && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{leave.reason}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                    <div className="flex-1 sm:flex-none">
                      {leave.status === 'pending' && (
                        <span className="inline-flex px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Pending
                        </span>
                      )}
                      {leave.status === 'approved' && (
                        <span className="inline-flex px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Approved
                        </span>
                      )}
                      {leave.status === 'rejected' && (
                        <span className="inline-flex px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded items-center gap-1">
                          <XCircle className="h-3 w-3" />
                          Rejected
                        </span>
                      )}
                      {leave.status === 'cancelled' && (
                        <span className="inline-flex px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded">
                          Cancelled
                        </span>
                      )}
                    </div>
                    {leave.status === 'pending' && (
                       <button
                          onClick={() => handleCancelLeave(leave.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          title="Cancel Request"
                        >
                          <X className="h-4 w-4" />
                        </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-card rounded-lg p-8 border border-border text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-muted-foreground">No leave requests yet</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRequests = () => {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg text-card-foreground">Self-Service Requests</h3>
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            New Request
          </button>
        </div>

        <div className="space-y-3">
          {staffRequests.length > 0 ? (
            staffRequests.map((request) => (
              <div key={request.id} className="bg-card rounded-lg p-4 border border-border">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-2 flex-shrink-0">
                      <Send className="h-5 w-5 text-purple-600 dark:text-purple-500" />
                    </div>
                    <div>
                      <p className="text-card-foreground font-medium capitalize">
                        {request.request_type.replace('_', ' ')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Submitted: {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                    {request.status === 'pending' && (
                      <span className="inline-flex px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Pending
                      </span>
                    )}
                    {request.status === 'approved' && (
                      <span className="inline-flex px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Approved
                      </span>
                    )}
                    {request.status === 'rejected' && (
                      <span className="inline-flex px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Rejected
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-card rounded-lg p-8 border border-border text-center">
              <Send className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-muted-foreground">No requests submitted yet</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDocuments = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-lg text-card-foreground">My Documents</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.length > 0 ? (
            documents.map((doc) => (
              <div key={doc.id} className="bg-card rounded-lg p-4 border border-border">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-2">
                      <FileText className="h-5 w-5 text-green-600 dark:text-green-500" />
                    </div>
                    <div>
                      <p className="text-card-foreground">{doc.title}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {doc.document_type.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button className="p-2 text-muted-foreground hover:bg-secondary rounded">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="md:col-span-2 bg-card rounded-lg p-8 border border-border text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-muted-foreground">No documents available</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCooperatives = () => {
    const handleViewCooperativeDetails = async (cooperativeId: string) => {
      setSelectedCooperativeId(cooperativeId);
      
      // Load detailed data for this cooperative
      try {
        const membership = myCooperatives.find(m => m.cooperative_id === cooperativeId);
        if (membership) {
          const [contributions, statement] = await Promise.all([
            cooperativeAPI.getContributions({ 
              cooperative_id: cooperativeId, 
              staff_id: user?.staff_id 
            }),
            cooperativeAPI.getMemberStatement(membership.id),
          ]);
          setCooperativeContributions(contributions);
          setCooperativeLoans(statement.loans || []);
        }
      } catch (error) {
        console.error('Error loading cooperative details:', error);
      }
    };

    const selectedMembership = myCooperatives.find(m => m.cooperative_id === selectedCooperativeId);
    const selectedCooperative = cooperatives.find(c => c.id === selectedCooperativeId);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg text-card-foreground">My Cooperative Memberships</h3>
          {selectedCooperativeId && (
            <button
              onClick={() => setSelectedCooperativeId('')}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-card hover:bg-accent border border-border rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Back to All
            </button>
          )}
        </div>

        {!selectedCooperativeId ? (
          <>
            {/* Overview Section */}
            {myCooperatives.length > 0 ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-6 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Active Memberships</p>
                        <p className="text-2xl text-card-foreground">
                          {myCooperatives.filter(m => m.status === 'active').length}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                        <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Monthly Deductions</p>
                        <p className="text-2xl text-card-foreground">
                          {formatCurrency(myCooperatives.reduce((sum, m) => sum + m.monthly_contribution, 0))}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                        <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Contributions</p>
                        <p className="text-2xl text-card-foreground">
                          {formatCurrency(myCooperatives.reduce((sum, m) => sum + m.total_contributions, 0))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Membership Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myCooperatives.map((membership) => {
                    const cooperative = cooperatives.find(c => c.id === membership.cooperative_id);
                    return (
                      <CooperativeMembershipCard
                        key={membership.id}
                        membership={membership}
                        cooperative={cooperative}
                        showDetails={true}
                        onClick={() => handleViewCooperativeDetails(membership.cooperative_id)}
                      />
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="bg-card rounded-lg p-12 border border-border text-center">
                <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg mb-2 text-card-foreground">No Cooperative Memberships</h4>
                <p className="text-muted-foreground mb-4">
                  You are not currently a member of any cooperative society
                </p>
                <p className="text-sm text-muted-foreground">
                  Contact your HR department to join a cooperative society
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Detailed View for Selected Cooperative */}
            {selectedMembership && selectedCooperative && (
              <div className="space-y-6">
                {/* Cooperative Header */}
                <div className="p-6 rounded-lg border border-border bg-card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <Building2 className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl text-card-foreground">{selectedCooperative.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedCooperative.code} • {selectedCooperative.cooperative_type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      selectedMembership.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                    }`}>
                      {selectedMembership.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Member Number</p>
                      <p className="text-sm text-card-foreground">{selectedMembership.member_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Join Date</p>
                      <p className="text-sm text-card-foreground">
                        {new Date(selectedMembership.join_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Monthly Contribution</p>
                      <p className="text-sm text-card-foreground">
                        {formatCurrency(selectedMembership.monthly_contribution)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Shares Owned</p>
                      <p className="text-sm text-card-foreground">
                        {selectedMembership.shares_owned} shares
                      </p>
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-6 rounded-lg border border-border bg-card">
                    <p className="text-sm text-muted-foreground mb-1">Total Contributions</p>
                    <p className="text-2xl text-card-foreground">
                      {formatCurrency(selectedMembership.total_contributions)}
                    </p>
                  </div>
                  <div className="p-6 rounded-lg border border-border bg-card">
                    <p className="text-sm text-muted-foreground mb-1">Share Capital Value</p>
                    <p className="text-2xl text-card-foreground">
                      {formatCurrency(selectedMembership.total_share_capital)}
                    </p>
                  </div>
                  <div className="p-6 rounded-lg border border-border bg-card">
                    <p className="text-sm text-muted-foreground mb-1">Loans Outstanding</p>
                    <p className="text-2xl text-card-foreground">
                      {formatCurrency(selectedMembership.outstanding_loan_balance)}
                    </p>
                  </div>
                </div>

                {/* Contribution History */}
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <h4 className="text-card-foreground">Contribution History</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Date</th>
                          <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Month</th>
                          <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Type</th>
                          <th className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Amount</th>
                          <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Method</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {cooperativeContributions.length > 0 ? (
                          cooperativeContributions.map((contribution) => (
                            <tr key={contribution.id} className="hover:bg-accent transition-colors">
                              <td className="px-6 py-4 text-sm text-card-foreground">
                                {new Date(contribution.payment_date).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-sm text-card-foreground">
                                {contribution.contribution_month}
                              </td>
                              <td className="px-6 py-4">
                                <span className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground">
                                  {contribution.contribution_type.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right text-sm text-card-foreground">
                                {formatCurrency(contribution.amount)}
                              </td>
                              <td className="px-6 py-4 text-sm text-muted-foreground">
                                {contribution.payment_method.replace('_', ' ')}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                              No contribution history available
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cooperative-Linked Loans */}
                {cooperativeLoans.length > 0 && (
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <div className="p-4 border-b border-border">
                      <h4 className="text-card-foreground">Cooperative Loans</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Date</th>
                            <th className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Amount</th>
                            <th className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Repaid</th>
                            <th className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Outstanding</th>
                            <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {cooperativeLoans.map((loan) => (
                            <tr key={loan.id} className="hover:bg-accent transition-colors">
                              <td className="px-6 py-4 text-sm text-card-foreground">
                                {new Date(loan.disbursement_date).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-right text-sm text-card-foreground">
                                {formatCurrency(loan.amount_disbursed)}
                              </td>
                              <td className="px-6 py-4 text-right text-sm text-card-foreground">
                                {formatCurrency(loan.total_repaid)}
                              </td>
                              <td className="px-6 py-4 text-right text-sm text-card-foreground">
                                {formatCurrency(loan.outstanding_balance)}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  loan.repayment_status === 'fully_paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                  loan.repayment_status === 'ongoing' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                  {loan.repayment_status.replace('_', ' ')}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderSettings = () => {
    const enablePushNotifications = async () => {
      if (!pushSupported) {
        showToast('error', 'Push notifications are not supported on this device');
        return;
      }
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          showToast('error', 'Permission denied for push notifications');
          setPushEnabled(false);
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          showToast('error', 'Push notification configuration missing');
          return;
        }
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }
        const subJson = subscription.toJSON();
        await notificationAPI.subscribe({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        });
        setPushEnabled(true);
        showToast('success', 'Push notifications enabled');
      } catch (error) {
        setPushEnabled(false);
        showToast('error', 'Failed to enable push notifications');
      }
    };

    const disablePushNotifications = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await notificationAPI.unsubscribe({ endpoint: subscription.endpoint });
          await subscription.unsubscribe();
        } else {
          await notificationAPI.unsubscribe({});
        }
        setPushEnabled(false);
        showToast('success', 'Push notifications disabled');
      } catch (error) {
        showToast('error', 'Failed to disable push notifications');
      }
    };

    return (
      <div className="space-y-4">
        <h3 className="text-lg text-card-foreground">Settings</h3>

        <div className="bg-card rounded-lg p-6 border border-border">
          <h4 className="mb-4 text-card-foreground">Change Password</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="col-span-1">
              <label className="block text-sm mb-1 text-muted-foreground">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPwd ? 'text' : 'password'}
                  className="w-full pr-10 px-3 py-2 border border-border rounded-md bg-card text-card-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="col-span-1">
              <label className="block text-sm mb-1 text-muted-foreground">New Password</label>
              <div className="relative">
                <input
                  type={showNewPwd ? 'text' : 'password'}
                  className="w-full pr-10 px-3 py-2 border border-border rounded-md bg-card text-card-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd(!showNewPwd)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="col-span-1">
              <label className="block text-sm mb-1 text-muted-foreground">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPwd ? 'text' : 'password'}
                  className="w-full pr-10 px-3 py-2 border border-border rounded-md bg-card text-card-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button className="md:col-start-2 md:col-span-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Update Password
            </button>
          </div>
        </div>

        <div className="bg-card rounded-lg p-6 border border-border">
          <h4 className="mb-4 text-card-foreground">Notifications</h4>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="rounded" />
              <span className="text-card-foreground">Email notifications for payslip generation</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="rounded" />
              <span className="text-card-foreground">Email notifications for leave approval</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="rounded" />
              <span className="text-card-foreground">Email notifications for promotion updates</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={pushEnabled}
                onChange={(e) => {
                  if (e.target.checked) {
                    enablePushNotifications();
                  } else {
                    disablePushNotifications();
                  }
                }}
                disabled={!pushSupported}
                className="rounded"
              />
              <span className="text-card-foreground">Push notifications for approvals and important updates</span>
            </label>
            {!pushSupported && (
              <p className="text-xs text-muted-foreground">
                Push notifications are not supported in this browser.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderLoans = () => {
    const handleApplyLoan = async () => {
      if (!user?.staff_id) return;
      
      try {
        // Prepare application data with optional cooperative link
        const applicationData: any = {
          staff_id: user.staff_id,
          loan_type_id: loanForm.loan_type_id,
          amount_requested: loanForm.amount_requested,
          purpose: loanForm.purpose,
          tenure_months: loanForm.tenure_months,
        };
        
        // Add cooperative data if selected
        if (loanForm.cooperative_id) {
          const selectedCooperative = cooperatives.find(c => c.id === loanForm.cooperative_id);
          applicationData.cooperative_id = loanForm.cooperative_id;
          applicationData.cooperative_name = selectedCooperative?.name;
        }
        
        const application = await loanApplicationAPI.create(applicationData);
        
        // Submit with guarantors if required
        const selectedLoanType = loanTypes.find(lt => lt.id === loanForm.loan_type_id);
        if (selectedLoanType?.requires_guarantors && loanForm.guarantors.length > 0) {
          await loanApplicationAPI.submit(application.id, loanForm.guarantors.map(g => ({ staff_id: g })));
        }
        
        showToast('success', 'Loan application submitted successfully');
        setShowLoanModal(false);
        setLoanForm({
          loan_type_id: '',
          amount_requested: 0,
          purpose: '',
          tenure_months: 12,
          guarantors: [],
          cooperative_id: '',
        });
        loadData();
      } catch (error: any) {
        showToast('error', error.message || 'Failed to submit loan application');
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleGuarantorResponse = async (guarantorId: string, action: 'accepted' | 'declined') => {
      setProcessingId(guarantorId);
      try {
        await guarantorAPI.respondToRequest(guarantorId, action);
        showToast('success', `Guarantor request ${action}`);
        loadData();
      } catch (error: any) {
        showToast('error', error.message);
      } finally {
        setProcessingId(null);
      }
    };

    const getStatusBadge = (status: string) => {
      const colors: Record<string, string> = {
        draft: 'bg-gray-500',
        pending: 'bg-yellow-500',
        guarantor_pending: 'bg-orange-500',
        approved: 'bg-green-500',
        rejected: 'bg-red-500',
        disbursed: 'bg-blue-500',
      };
      return (
        <span className={`px-2 py-1 rounded text-xs text-white ${colors[status] || 'bg-gray-500'}`}>
          {status.replace('_', ' ').toUpperCase()}
        </span>
      );
    };

    return (
      <div className="space-y-6">
        {/* Apply for Loan Button */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg text-card-foreground">My Loans</h3>
          <button
            onClick={() => setShowLoanModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
          >
            <Plus className="h-4 w-4" />
            Apply for Loan
          </button>
        </div>

        {/* Loan Applications */}
        <div className="bg-card rounded-lg border border-border">
          <div className="p-4 border-b border-border">
            <h4 className="text-card-foreground">My Loan Applications</h4>
          </div>
          <div className="p-4">
            {loanApplications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No loan applications found
              </div>
            ) : (
              <div className="space-y-3">
                {loanApplications.map((app) => (
                  <div
                    key={app.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-gray-900 dark:text-white">{app.loan_type_name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{app.application_number}</div>
                      </div>
                      {getStatusBadge(app.status)}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Amount</div>
                        <div className="text-gray-900 dark:text-white">{formatCurrency(app.amount_requested)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Tenure</div>
                        <div className="text-gray-900 dark:text-white">{app.tenure_months} months</div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Monthly Repayment</div>
                        <div className="text-gray-900 dark:text-white">{formatCurrency(app.monthly_deduction)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Applied Date</div>
                        <div className="text-gray-900 dark:text-white">{new Date(app.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active Loans */}
        <div className="bg-card rounded-lg border border-border">
          <div className="p-4 border-b border-border">
            <h4 className="text-card-foreground">Active Loans</h4>
          </div>
          <div className="p-4">
            {myLoans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No active loans
              </div>
            ) : (
              <div className="space-y-3">
                {myLoans.map((loan) => (
                  <div
                    key={loan.id}
                    className="p-4 border border-border rounded-lg"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-card-foreground">{loan.loan_type_name}</div>
                        <div className="text-sm text-muted-foreground">{loan.disbursement_number}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs text-white ${
                        loan.status === 'active' ? 'bg-green-500' : 'bg-gray-500'
                      }`}>
                        {loan.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Total Amount</div>
                        <div className="text-card-foreground">{formatCurrency(loan.total_amount)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Outstanding</div>
                        <div className="text-red-600 dark:text-red-400">{formatCurrency(loan.balance_outstanding)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Total Repaid</div>
                        <div className="text-green-600 dark:text-green-400">{formatCurrency(loan.total_repaid)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Monthly Deduction</div>
                        <div className="text-card-foreground">{formatCurrency(loan.monthly_deduction)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Guarantor Requests */}
        {guarantorRequests.length > 0 && (
          <div className="bg-card rounded-lg border border-border">
            <div className="p-4 border-b border-border">
              <h4 className="text-card-foreground">Guarantor Requests</h4>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {guarantorRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 border border-border rounded-lg"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-card-foreground">
                          {req.application?.staff_name} - {req.application?.loan_type_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Amount: {formatCurrency(req.application?.amount_requested)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Your liability: {formatCurrency(req.liability_amount)}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs text-white ${
                        req.consent_status === 'pending' ? 'bg-yellow-500' : 
                        req.consent_status === 'accepted' ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {req.consent_status.toUpperCase()}
                      </span>
                    </div>
                    {req.consent_status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleGuarantorResponse(req.id, 'accepted')}
                          disabled={processingId === req.id}
                          className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm disabled:opacity-50"
                        >
                          {processingId === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Accept
                        </button>
                        <button
                          onClick={() => handleGuarantorResponse(req.id, 'declined')}
                          disabled={processingId === req.id}
                          className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm disabled:opacity-50"
                        >
                          {processingId === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loan Application Modal */}
        {showLoanModal && (
          <Modal
            isOpen={showLoanModal}
            onClose={() => setShowLoanModal(false)}
            title="Apply for Loan"
          >
            <form onSubmit={(e) => { e.preventDefault(); handleApplyLoan(); }} className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Loan Type *</label>
                <select
                  required
                  value={loanForm.loan_type_id}
                  onChange={(e) => setLoanForm({ ...loanForm, loan_type_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">-- Select Loan Type --</option>
                  {loanTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} - {type.interest_rate}% interest
                    </option>
                  ))}
                </select>
              </div>
              
              {myCooperatives.length > 0 && (
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">
                    Cooperative (Optional)
                  </label>
                  <select
                    value={loanForm.cooperative_id}
                    onChange={(e) => setLoanForm({ ...loanForm, cooperative_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">-- None (Regular Loan) --</option>
                    {myCooperatives
                      .filter(m => m.status === 'active')
                      .map((membership) => (
                        <option key={membership.cooperative_id} value={membership.cooperative_id}>
                          {membership.cooperative_name} (Member #{membership.member_number})
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Link this loan to a cooperative society for cooperative-specific benefits
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Amount Requested (₦) *</label>
                <input
                  type="number"
                  required
                  value={loanForm.amount_requested}
                  onChange={(e) => setLoanForm({ ...loanForm, amount_requested: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Purpose *</label>
                <textarea
                  required
                  value={loanForm.purpose}
                  onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Repayment Period (months) *</label>
                <input
                  type="number"
                  required
                  value={loanForm.tenure_months}
                  onChange={(e) => setLoanForm({ ...loanForm, tenure_months: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Submit Application
                </button>
                <button
                  type="button"
                  onClick={() => setShowLoanModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    );
  };

  if (loading) {
    return <PageSkeleton mode="grid" />;
  }

  return (
    <div className="p-6">
      <Breadcrumb items={[{ label: 'Staff Portal' }]} />

      {/* Tab Navigation */}
      <div className="bg-card rounded-lg border border-border mb-6">
        <div className="flex overflow-x-auto">
          {[
            { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard },
            { id: 'profile' as TabType, label: 'My Profile', icon: User },
            { id: 'payslips' as TabType, label: 'My Payslips', icon: FileText },
            { id: 'promotions' as TabType, label: 'Promotions', icon: Award },
            { id: 'leave' as TabType, label: 'Leave', icon: Calendar },
            { id: 'loans' as TabType, label: 'Loans', icon: Wallet },
            { id: 'cooperatives' as TabType, label: 'Cooperatives', icon: Building2 },
            { id: 'requests' as TabType, label: 'Requests', icon: Send },
            { id: 'documents' as TabType, label: 'Documents', icon: CreditCard },
            { id: 'settings' as TabType, label: 'Settings', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-600 text-green-600 dark:text-green-500'
                    : 'border-transparent text-muted-foreground hover:text-card-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'profile' && renderProfile()}
        {activeTab === 'payslips' && renderPayslips()}
        {activeTab === 'promotions' && renderPromotions()}
        {activeTab === 'leave' && renderLeave()}
        {activeTab === 'loans' && renderLoans()}
        {activeTab === 'cooperatives' && renderCooperatives()}
        {activeTab === 'requests' && renderRequests()}
        {activeTab === 'documents' && renderDocuments()}
        {activeTab === 'settings' && renderSettings()}
      </div>

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <Modal
          isOpen={showLeaveModal}
          onClose={() => setShowLeaveModal(false)}
          title="Request Leave"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1 text-muted-foreground">Leave Type</label>
              <select
                value={leaveForm.leave_type}
                onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-border rounded-md bg-card text-card-foreground"
              >
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="maternity">Maternity Leave</option>
                <option value="paternity">Paternity Leave</option>
                <option value="study">Study Leave</option>
                <option value="compassionate">Compassionate Leave</option>
                <option value="unpaid">Unpaid Leave</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-muted-foreground">Start Date</label>
                <input
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-card text-card-foreground"
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-muted-foreground">End Date</label>
                <input
                  type="date"
                  value={leaveForm.end_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-card text-card-foreground"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1 text-muted-foreground">Relief Officer (Optional)</label>
              <input
                type="text"
                value={leaveForm.relief_officer}
                onChange={(e) => setLeaveForm({ ...leaveForm, relief_officer: e.target.value })}
                placeholder="Name of relief officer"
                className="w-full px-3 py-2 border border-border rounded-md bg-card text-card-foreground"
              />
            </div>

            <div>
              <label className="block text-sm mb-1 text-muted-foreground">Reason</label>
              <textarea
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                rows={3}
                placeholder="Reason for leave request"
                className="w-full px-3 py-2 border border-border rounded-md bg-card text-card-foreground"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleCreateLeaveRequest}
                disabled={isSubmitting}
                className={`flex-1 px-4 py-2 rounded text-white flex items-center justify-center ${isSubmitting ? 'bg-green-500 opacity-75 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </button>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Staff Request Modal */}
      {showRequestModal && (
        <Modal
          isOpen={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          title="New Self-Service Request"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1 text-muted-foreground">Request Type</label>
              <select
                value={requestType}
                onChange={(e) => {
                  setRequestType(e.target.value as any);
                  setRequestForm({});
                }}
                className="w-full px-3 py-2 border border-border rounded-md bg-card text-card-foreground"
              >
                <option value="contact_update">Update Contact Details</option>
                <option value="bank_update">Update Bank Account</option>
                <option value="nok_update">Update Next of Kin</option>
                <option value="salary_certificate">Request Salary Certificate</option>
                <option value="employment_verification">Request Employment Verification</option>
              </select>
            </div>

            {requestType === 'contact_update' && (
              <>
                <div>
                  <label className="block text-sm mb-1 text-muted-foreground">Phone Number</label>
                  <input
                    type="tel"
                    value={requestForm.phone || ''}
                    onChange={(e) => setRequestForm({ ...requestForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md bg-card text-card-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-muted-foreground">Email</label>
                  <input
                    type="email"
                    value={requestForm.email || ''}
                    onChange={(e) => setRequestForm({ ...requestForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md bg-card text-card-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-muted-foreground">Address</label>
                  <textarea
                    value={requestForm.address || ''}
                    onChange={(e) => setRequestForm({ ...requestForm, address: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-border rounded-md bg-card text-card-foreground"
                  />
                </div>
              </>
            )}

            {requestType === 'bank_update' && (
              <>
                <div>
                  <label className="block text-sm mb-1 text-muted-foreground">Bank Name</label>
                  <input
                    type="text"
                    value={requestForm.bank_name || ''}
                    onChange={(e) => setRequestForm({ ...requestForm, bank_name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md bg-card text-card-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-muted-foreground">Account Number</label>
                  <input
                    type="text"
                    value={requestForm.account_number || ''}
                    onChange={(e) => setRequestForm({ ...requestForm, account_number: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-md bg-card text-card-foreground"
                  />
                </div>
              </>
            )}

            {requestType === 'nok_update' && (
              <>
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Name</label>
                  <input
                    type="text"
                    value={requestForm.name || ''}
                    onChange={(e) => setRequestForm({ ...requestForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Relationship</label>
                  <input
                    type="text"
                    value={requestForm.relationship || ''}
                    onChange={(e) => setRequestForm({ ...requestForm, relationship: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Phone</label>
                  <input
                    type="tel"
                    value={requestForm.phone || ''}
                    onChange={(e) => setRequestForm({ ...requestForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-gray-300">Address</label>
                  <textarea
                    value={requestForm.address || ''}
                    onChange={(e) => setRequestForm({ ...requestForm, address: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </>
            )}

            {(requestType === 'salary_certificate' || requestType === 'employment_verification') && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  This request will be processed by HR. You will be notified when your document is ready.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleCreateStaffRequest}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Request
              </button>
              <button
                onClick={() => setShowRequestModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Payslip Detail Modal */}
      {showPayslipModal && selectedPayslip && (
        <Modal
          isOpen={showPayslipModal}
          onClose={() => setShowPayslipModal(false)}
          title={`Payslip - ${selectedPayslip.batch?.month || selectedPayslip.line?.payroll_month}`}
          size="xl"
        >
          <div className="p-0">
            <div className="flex justify-end p-4 border-b border-border bg-muted/20">
               <button
                  onClick={() => handleDownloadPayslip(selectedPayslip)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Payslip
                </button>
            </div>
            <PayslipTemplate payslip={selectedPayslip} user={user} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
