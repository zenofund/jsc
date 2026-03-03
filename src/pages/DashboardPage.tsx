import React, { useEffect, useState } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../lib/api-client';
import { 
  Users, DollarSign, AlertCircle, CheckCircle, 
  TrendingUp, Calendar, FileText, Clock, Award, ChevronLeft, ChevronRight
} from 'lucide-react';

import { PageSkeleton } from '../components/PageLoader';
import { Skeleton } from '../components/ui/skeleton';
import { formatCurrency } from '../utils/format';

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  useEffect(() => {
    // Redirect HR Managers to their dedicated dashboard
    if (user?.role === 'hr_manager') {
      (window as any).navigateTo?.('hr-dashboard');
      return;
    }
    // Redirect Cashiers to their dedicated dashboard
    if (user?.role === 'cashier') {
      (window as any).navigateTo?.('cashier-dashboard');
      return;
    }
    // Redirect Reviewers, Approvers, and Auditors to their dedicated dashboard
    if (['reviewer', 'approver', 'auditor', 'audit'].includes(user?.role || '')) {
      (window as any).navigateTo?.('approvals');
      return;
    }
    // Redirect Staff to their dedicated portal
    if (user?.role === 'staff') {
      (window as any).navigateTo?.('staff-portal');
      return;
    }
    loadDashboardData();
  }, [user]);

  useEffect(() => {
    loadCalendarEvents();
  }, [calendarDate]);

  const loadDashboardData = async () => {
    try {
      const data = await dashboardAPI.getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarEvents = async () => {
    try {
      const events = await dashboardAPI.getCalendarEvents(
        calendarDate.getFullYear(),
        calendarDate.getMonth()
      );
      setCalendarEvents(events);
    } catch (error) {
      console.error('Error loading calendar events:', error);
    }
  };

  if (loading) {
    return <PageSkeleton mode="grid" />;
  }

  const statCards = [
    {
      title: 'Total Staff',
      value: stats?.total_staff || 0,
      icon: Users,
      color: 'blue',
      subtitle: `${stats?.active_staff || 0} active`,
    },
    {
      title: 'Pending Approvals',
      value: stats?.pending_approvals || 0,
      icon: Clock,
      color: 'yellow',
      subtitle: 'Awaiting review',
    },
    {
      title: 'Pending Arrears',
      value: stats?.pending_arrears || 0,
      icon: AlertCircle,
      color: 'red',
      subtitle: 'Requires attention',
    },
    {
      title: 'Active Payroll',
      value: stats?.active_payroll_count || 0,
      icon: DollarSign,
      color: 'green',
      subtitle: 'In progress',
    },
  ];

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    green: 'bg-green-100 text-green-600',
  };

  return (
    <div>
      <Breadcrumb items={[{ label: 'Dashboard' }]} />
      
      <div className="mb-4 sm:mb-6">
        <h1 className="page-title">Welcome back, {user?.full_name}</h1>
        <p className="text-muted-foreground text-sm sm:text-base">Here's what's happening with your payroll system today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 justify-items-center sm:justify-items-stretch max-w-sm sm:max-w-none mx-auto">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-card border border-border rounded-lg p-4 sm:p-6 w-full">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${colorClasses[stat.color as keyof typeof colorClasses]} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xl sm:text-2xl font-semibold text-foreground mb-0.5">{stat.value}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">{stat.title}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground/80 mt-2 ml-11 sm:ml-14">{stat.subtitle}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
          <h3 className="font-semibold text-card-foreground mb-3 sm:mb-4 text-base sm:text-lg">Quick Actions</h3>
          <div className="space-y-2 sm:space-y-3">
            {['admin', 'payroll_officer', 'approver', 'reviewer', 'payroll_loader'].includes(user?.role || '') && (
              <button 
                onClick={() => (window as any).navigateTo?.('payroll')}
                className="w-full flex items-center gap-3 p-3 sm:p-4 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50 active:bg-green-200 dark:active:bg-green-950/70 rounded-lg transition-colors">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-green-600 dark:bg-green-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-medium text-foreground text-sm sm:text-base">Run New Payroll</p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Create payroll batch for this month</p>
                </div>
              </button>
            )}

            {['admin', 'payroll_officer'].includes(user?.role || '') && (
              <button 
                onClick={() => (window as any).navigateTo?.('staff')}
                className="w-full flex items-center gap-3 p-3 sm:p-4 bg-accent/50 hover:bg-accent active:bg-accent/80 rounded-lg transition-colors">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-accent-foreground" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-medium text-foreground text-sm sm:text-base">Add New Staff</p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Register new employee</p>
                </div>
              </button>
            )}

            {['admin', 'payroll_officer', 'payroll_loader'].includes(user?.role || '') && (
              <button 
                onClick={() => (window as any).navigateTo?.('arrears')}
                className="w-full flex items-center gap-3 p-3 sm:p-4 bg-green-50/50 dark:bg-green-950/20 hover:bg-green-100/50 dark:hover:bg-green-950/40 active:bg-green-200/50 dark:active:bg-green-950/60 rounded-lg transition-colors">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-green-600 dark:bg-green-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-medium text-foreground text-sm sm:text-base">View Arrears</p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Manage pending arrears</p>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Recent Payroll Batches */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
          <h3 className="font-semibold text-card-foreground mb-3 sm:mb-4 text-base sm:text-lg">Recent Payroll Batches</h3>
          <div className="space-y-2 sm:space-y-3">
            {stats?.recent_batches?.length > 0 ? (
              stats.recent_batches.map((batch: any) => (
                <div key={batch.id} className="flex items-center justify-between p-3 sm:p-4 bg-muted/30 rounded-lg">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="font-medium text-foreground text-sm sm:text-base truncate">{batch.batch_number}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{batch.month}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <StatusBadge status={batch.status} />
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {formatCurrency(batch.total_net)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm">No recent payroll batches</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payroll Calendar */}
      <div className="mt-4 sm:mt-6 bg-card border border-border rounded-lg p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="font-semibold text-card-foreground text-base sm:text-lg">Payroll Calendar</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
              className="p-1.5 hover:bg-muted rounded transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-sm sm:text-base font-medium text-foreground min-w-[120px] text-center">
              {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
              className="p-1.5 hover:bg-muted rounded transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-xs sm:text-sm font-medium text-muted-foreground p-1 sm:p-2">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.slice(0, 1)}</span>
            </div>
          ))}
          {(() => {
            const year = calendarDate.getFullYear();
            const month = calendarDate.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const today = new Date();
            const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
            const todayDate = today.getDate();
            
            const days = [];
            
            // Empty cells before first day
            for (let i = 0; i < firstDay; i++) {
              days.push(
                <div key={`empty-${i}`} className="text-center p-1.5 sm:p-3 text-muted-foreground/30"></div>
              );
            }
            
            // Days of the month
            for (let day = 1; day <= daysInMonth; day++) {
              const dayEvents = calendarEvents.filter(e => e.date === day);
              const isToday = isCurrentMonth && day === todayDate;
              const hasCutoff = dayEvents.some(e => e.type === 'cutoff');
              const hasCreated = dayEvents.some(e => e.type === 'created');
              const hasApproved = dayEvents.some(e => e.type === 'approved');
              const hasPaid = dayEvents.some(e => e.type === 'paid');
              
              days.push(
                <button
                  key={day}
                  onClick={() => {
                    if (dayEvents.length > 0) {
                      setSelectedEvent({ day, events: dayEvents });
                    }
                  }}
                  className={`relative text-center p-1.5 sm:p-3 rounded text-xs sm:text-sm transition-colors ${
                    isToday
                      ? 'bg-primary text-primary-foreground font-semibold ring-2 ring-primary ring-offset-1'
                      : hasPaid
                      ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 font-medium hover:bg-green-200 dark:hover:bg-green-950/60'
                      : hasApproved
                      ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-200 dark:hover:bg-blue-950/60'
                      : hasCreated
                      ? 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 font-medium hover:bg-yellow-200 dark:hover:bg-yellow-950/60'
                      : hasCutoff
                      ? 'bg-accent text-accent-foreground font-medium hover:bg-accent/80'
                      : 'text-foreground hover:bg-muted'
                  } ${dayEvents.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {day}
                  {dayEvents.length > 1 && (
                    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {dayEvents.slice(0, 3).map((_, i) => (
                        <div key={i} className="w-1 h-1 rounded-full bg-current opacity-60"></div>
                      ))}
                    </div>
                  )}
                </button>
              );
            }
            
            return days;
          })()}
        </div>
        
        <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-primary rounded"></div>
            <span className="text-muted-foreground">Today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-yellow-100 dark:bg-yellow-950/40 border border-yellow-300 dark:border-yellow-700 rounded"></div>
            <span className="text-muted-foreground">Created</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-100 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 rounded"></div>
            <span className="text-muted-foreground">Approved</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-100 dark:bg-green-950/40 border border-green-300 dark:border-green-700 rounded"></div>
            <span className="text-muted-foreground">Paid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-accent border border-accent-foreground/20 rounded"></div>
            <span className="text-muted-foreground">Payroll Cutoff</span>
          </div>
        </div>
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <Modal
          isOpen={true}
          title={`Events on ${calendarDate.toLocaleDateString('en-US', { month: 'long' })} ${selectedEvent.day}`}
          onClose={() => setSelectedEvent(null)}
        >
          <div className="space-y-3">
            {selectedEvent.events.map((event: any, index: number) => (
              <div key={index} className="p-3 bg-muted/30 rounded-lg">
                {event.type === 'cutoff' ? (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-accent" />
                    <div>
                      <p className="font-medium text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground">Monthly payroll deadline</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {event.type === 'created' && <FileText className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />}
                        {event.type === 'approved' && <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                        {event.type === 'paid' && <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />}
                        <p className="font-medium text-foreground capitalize">{event.type}</p>
                      </div>
                      <StatusBadge status={event.status} />
                    </div>
                    <p className="text-sm text-foreground mb-1">{event.batch_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(event.amount)} • {new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
