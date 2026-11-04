import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { StatusBadge } from '../components/StatusBadge';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
import { useAuth } from '../contexts/AuthContext';
import { staffAPI, staffPortalAPI, departmentAPI } from '../lib/api-client';
import { PageSkeleton } from '../components/PageLoader';
import { 
  Users, Calendar, Clock, CheckCircle, 
  UserCheck, Briefcase, FileText, AlertCircle
} from 'lucide-react';

export function HRDashboardPage() {
  const { user } = useAuth();
  const [hrStats, setHrStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
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
        resigned: allStaff.filter((s: any) => s.status === 'resigned').length,
        secondment: allStaff.filter((s: any) => s.status === 'secondment').length,
        interdiction: allStaff.filter((s: any) => s.status === 'interdiction').length,
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
      tone: 'blue',
      description: `${hrStats?.statusBreakdown.active || 0} currently active`,
    },
    {
      title: 'Pending Leave Requests',
      value: hrStats?.pendingLeaveCount || 0,
      icon: Clock,
      tone: 'yellow',
      description: 'Awaiting review',
    },
    {
      title: 'Approved This Month',
      value: hrStats?.approvedLeaveThisMonth || 0,
      icon: CheckCircle,
      tone: 'green',
      description: 'Leave requests this month',
    },
    {
      title: 'Departments',
      value: hrStats?.totalDepartments || 0,
      icon: Briefcase,
      tone: 'purple',
      description: 'Organization structure',
    },
  ] as const;

  return (
    <div className="space-y-5 sm:space-y-7">
      <Breadcrumb items={[{ label: 'HR Dashboard' }]} />
      
      <section className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-green-950 via-green-900 to-green-800 px-5 py-6 shadow-lg shadow-green-950/10 sm:px-8 sm:py-8">
        <div aria-hidden="true" className="absolute -right-10 -top-20 h-64 w-64 rounded-full border border-white/10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">People operations</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Welcome back, {user?.full_name || 'there'}</h1>
            <p className="mt-2 text-sm text-green-50/80 sm:text-base">Staff, leave, and department activity at a glance.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white">
            <Calendar className="h-4 w-4 text-emerald-200" />
            {new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}
          </span>
        </div>
      </section>

      {(hrStats?.pendingLeaveCount || 0) > 0 && (
        <button
          onClick={() => (window as any).navigateTo?.('leave-management')}
          className="flex w-full items-center justify-between gap-4 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-left transition-colors hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 sm:px-5"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              <Clock className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-foreground">{hrStats.pendingLeaveCount} leave {hrStats.pendingLeaveCount === 1 ? 'request' : 'requests'} need review</span>
              <span className="block text-sm text-muted-foreground">Open leave management to review pending requests.</span>
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-amber-800 dark:text-amber-200">Review</span>
        </button>
      )}

      <section aria-label="HR snapshot">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">HR snapshot</h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Current workforce and leave figures.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {statCards.map((stat) => (
            <DashboardMetricCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              description={stat.description}
              icon={stat.icon}
              tone={stat.tone}
            />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-6">
        {/* Staff Status Breakdown */}
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">Staff status</h2>
              <p className="mt-1 text-sm text-muted-foreground">Current workforce distribution.</p>
            </div>
            <UserCheck className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {Object.entries(hrStats?.statusBreakdown || {}).map(([status, count]) => {
              const share = hrStats?.totalStaff ? ((count as number) / hrStats.totalStaff) * 100 : 0;
              return (
                <div key={status}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <StatusBadge status={status as any} />
                    <span className="text-sm font-semibold tabular-nums text-foreground">{count as number}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">Staff by department</h2>
              <p className="mt-1 text-sm text-muted-foreground">Largest teams by staff count.</p>
            </div>
            <Briefcase className="h-5 w-5 text-muted-foreground" />
          </div>
          {Object.entries(hrStats?.departmentBreakdown || {}).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(hrStats?.departmentBreakdown || {})
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 5)
                .map(([dept, count]) => (
                  <div key={dept}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-foreground">{dept}</span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">{count as number}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${hrStats?.totalStaff ? ((count as number) / hrStats.totalStaff) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Department information is not available.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-6">
        {/* Leave Type Breakdown */}
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">Leave requests by type</h2>
              <p className="mt-1 text-sm text-muted-foreground">Recorded leave across all statuses.</p>
            </div>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
          {Object.entries(hrStats?.leaveTypeBreakdown || {}).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(hrStats?.leaveTypeBreakdown || {})
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
                    <span className="text-sm text-foreground capitalize">{type.replace('_', ' ')}</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">{count as number}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No leave requests have been recorded.</p>
          )}
        </div>

        {/* Staff Currently on Leave */}
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">Staff currently on leave</h2>
              <p className="mt-1 text-sm text-muted-foreground">Team members marked as on leave.</p>
            </div>
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          {hrStats?.staffOnLeave && hrStats.staffOnLeave.length > 0 ? (
            <div className="space-y-2">
              {hrStats.staffOnLeave.slice(0, 5).map((staff: any) => (
                <div key={staff.id} className="flex items-center justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {staff.bio_data.first_name} {staff.bio_data.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{staff.staff_number}</p>
                  </div>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">{staff.appointment.department}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No staff currently on leave.</p>
          )}
        </div>
      </div>

      {/* Recent Leave Requests */}
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground sm:text-lg">Recent leave requests</h2>
            <p className="mt-1 text-sm text-muted-foreground">Latest staff leave activity.</p>
          </div>
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
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">Quick actions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Common staff and leave management tasks.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button 
            onClick={() => (window as any).navigateTo?.('staff')}
            className="flex min-h-12 items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-left transition-colors hover:bg-muted"
          >
            <Users className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">View All Staff</span>
          </button>
          <button 
            onClick={() => (window as any).navigateTo?.('leave-management')}
            className="flex min-h-12 items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-left transition-colors hover:bg-muted"
          >
            <Calendar className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">Manage Leave</span>
          </button>
          <button 
            onClick={() => (window as any).navigateTo?.('department-management')}
            className="flex min-h-12 items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-left transition-colors hover:bg-muted"
          >
            <Briefcase className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">Departments</span>
          </button>
          <button 
            onClick={() => (window as any).navigateTo?.('reports')}
            className="flex min-h-12 items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-left transition-colors hover:bg-muted"
          >
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">Generate Report</span>
          </button>
        </div>
      </div>
    </div>
  );
}
