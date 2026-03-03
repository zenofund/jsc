import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { formatCompactCurrency } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI, staffAPI, staffPortalAPI, departmentAPI } from '../lib/api-client';
import { PageSkeleton } from '../components/PageLoader';
import { 
  Users, Calendar, Clock, CheckCircle, 
  TrendingUp, Award, UserCheck, Briefcase,
  FileText, AlertCircle, XCircle
} from 'lucide-react';

export function HRDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [hrStats, setHrStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Get general dashboard stats
      const generalStats = await dashboardAPI.getDashboardStats();
      setStats(generalStats);

      // Get HR-specific stats
      const staffResponse = await staffAPI.getAllStaff();
      const rawStaffData = Array.isArray(staffResponse) ? staffResponse : (staffResponse.data || []);
      
      // Map flat data to nested structure
      const allStaff = rawStaffData.map((item: any) => {
        if (item.bio_data) return item;
        return {
          id: item.id,
          staff_number: item.staff_number,
          bio_data: {
            first_name: item.first_name,
            last_name: item.surname || item.last_name,
            middle_name: item.other_names || item.middle_name,
          },
          appointment: {
            department: item.department_name || item.department,
          },
          status: item.status,
        } as any; // Cast to any to avoid strict type checks on missing fields
      });

      const pendingLeaveResponse = await staffPortalAPI.getAllLeaveRequests('pending');
      const pendingLeave = Array.isArray(pendingLeaveResponse) ? pendingLeaveResponse : (pendingLeaveResponse.data || []);
      
      const allLeaveResponse = await staffPortalAPI.getAllLeaveRequests();
      const allLeave = Array.isArray(allLeaveResponse) ? allLeaveResponse : (allLeaveResponse.data || []);
      
      const departments = await departmentAPI.getAllDepartments();

      // Calculate staff status breakdown
      const statusBreakdown = {
        active: allStaff.filter((s: any) => s.status === 'active').length,
        on_leave: allStaff.filter((s: any) => s.status === 'on_leave').length,
        suspended: allStaff.filter((s: any) => s.status === 'suspended').length,
        retired: allStaff.filter((s: any) => s.status === 'retired').length,
        terminated: allStaff.filter((s: any) => s.status === 'terminated').length,
      };

      // Calculate leave type breakdown
      const leaveTypeBreakdown = allLeave.reduce((acc: any, leave: any) => {
        acc[leave.leave_type] = (acc[leave.leave_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculate department breakdown
      const departmentBreakdown = allStaff.reduce((acc: any, staff: any) => {
        const dept = staff.appointment.department;
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get recent leave requests
      const recentLeave = allLeave
        .sort((a: any, b: any) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5);

      setHrStats({
        totalStaff: allStaff.length,
        statusBreakdown,
        pendingLeaveCount: pendingLeave.length,
        approvedLeaveThisMonth: allLeave.filter((l: any) => {
          const approvalDate = l.approval_date;
          if (!approvalDate) return false;
          const thisMonth = new Date().toISOString().substring(0, 7);
          return l.status === 'approved' && approvalDate.substring(0, 7) === thisMonth;
        }).length,
        totalDepartments: departments.length,
        leaveTypeBreakdown,
        departmentBreakdown,
        recentLeave,
        staffOnLeave: allStaff.filter((s: any) => s.status === 'on_leave'),
      });
    } catch (error) {
      console.error('Error loading HR dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageSkeleton mode="grid" />;
  }

  const statCards = [
    {
      title: 'Total Staff',
      value: hrStats?.totalStaff || 0,
      icon: Users,
      color: 'blue',
      subtitle: `${hrStats?.statusBreakdown.active || 0} active`,
      trend: '+2.5% from last month',
    },
    {
      title: 'Pending Leave Requests',
      value: hrStats?.pendingLeaveCount || 0,
      icon: Clock,
      color: 'yellow',
      subtitle: 'Awaiting approval',
      trend: 'Requires attention',
    },
    {
      title: 'Approved This Month',
      value: hrStats?.approvedLeaveThisMonth || 0,
      icon: CheckCircle,
      color: 'green',
      subtitle: 'Leave requests',
      trend: 'Current month',
    },
    {
      title: 'Departments',
      value: hrStats?.totalDepartments || 0,
      icon: Briefcase,
      color: 'purple',
      subtitle: 'Active departments',
      trend: 'Organization structure',
    },
  ];

  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400',
    green: 'bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400',
    red: 'bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400',
  };

  return (
    <div>
      <Breadcrumb items={[{ label: 'HR Dashboard' }]} />
      
      <div className="mb-4 sm:mb-6">
        <h1 className="page-title">Welcome back, {user?.full_name}</h1>
        <p className="text-muted-foreground text-sm sm:text-base">Here's your HR management overview for today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 justify-items-center sm:justify-items-stretch max-w-sm sm:max-w-none mx-auto">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-card border border-border rounded-lg p-4 sm:p-6 hover:shadow-lg transition-shadow w-full">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${colorClasses[stat.color as keyof typeof colorClasses]} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col">
                    <div className="text-xl sm:text-2xl font-bold text-foreground mb-0.5">
                      {typeof stat.value === 'number' && stat.value > 999999 ? (
                        formatCompactCurrency(stat.value).short
                      ) : (
                        stat.value
                      )}
                    </div>
                    {typeof stat.value === 'number' && stat.value > 999999 && (
                      <span className="text-xs text-muted-foreground/70 font-mono">
                        {formatCompactCurrency(stat.value).full}
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">{stat.title}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground/80 mt-2 ml-11 sm:ml-14">{stat.subtitle}</div>
              <div className="text-xs text-primary mt-1 ml-11 sm:ml-14">{stat.trend}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Staff Status Breakdown */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Staff Status Overview</h2>
            <UserCheck className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {Object.entries(hrStats?.statusBreakdown || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusBadge status={status as any} />
                </div>
                <span className="text-lg font-semibold text-foreground">{count as number}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Staff by Department</h2>
            <Briefcase className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {Object.entries(hrStats?.departmentBreakdown || {})
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .slice(0, 5)
              .map(([dept, count]) => (
                <div key={dept} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{dept}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width: `${((count as number) / hrStats.totalStaff) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-foreground w-8 text-right">{count as number}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Leave Type Breakdown */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Leave Requests by Type</h2>
            <Calendar className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {Object.entries(hrStats?.leaveTypeBreakdown || {})
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm text-foreground capitalize">{type.replace('_', ' ')}</span>
                  <span className="text-lg font-semibold text-foreground">{count as number}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Staff Currently on Leave */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Staff Currently on Leave</h2>
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
          </div>
          <div className="space-y-3">
            {hrStats?.staffOnLeave && hrStats.staffOnLeave.length > 0 ? (
              hrStats.staffOnLeave.slice(0, 5).map((staff: any) => (
                <div key={staff.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-lg transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {staff.bio_data.first_name} {staff.bio_data.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{staff.staff_number}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{staff.appointment.department}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No staff currently on leave</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Leave Requests */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Recent Leave Requests</h2>
          <FileText className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Staff</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Leave Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Duration</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date Requested</th>
              </tr>
            </thead>
            <tbody>
              {hrStats?.recentLeave && hrStats.recentLeave.length > 0 ? (
                hrStats.recentLeave.map((leave: any) => (
                  <tr key={leave.id} className="border-b border-border hover:bg-muted transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{leave.staff_name}</p>
                        <p className="text-xs text-muted-foreground">{leave.staff_number}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-foreground capitalize">{(leave.leave_type || '').replace('_', ' ')}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-foreground">{leave.number_of_days} days</span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={leave.status} />
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-muted-foreground">
                        {new Date(leave.created_at).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No recent leave requests
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 bg-accent/50 dark:bg-accent/20 border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button 
            onClick={() => (window as any).navigateTo?.('staff')}
            className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <Users className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">View All Staff</span>
          </button>
          <button 
            onClick={() => (window as any).navigateTo?.('leave-management')}
            className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <Calendar className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">Manage Leave</span>
          </button>
          <button 
            onClick={() => (window as any).navigateTo?.('department-management')}
            className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <Briefcase className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">Departments</span>
          </button>
          <button 
            onClick={() => (window as any).navigateTo?.('reports')}
            className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">Generate Report</span>
          </button>
        </div>
      </div>
    </div>
  );
}