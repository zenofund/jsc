// Leave Deduction Calculator
// Handles calculation of salary deductions for unpaid leave

import type { LeaveRequest } from '../types/entities';

export interface LeaveDeductionResult {
  unpaid_days: number;
  deduction_amount: number;
  working_days_in_month: number;
  days_on_unpaid_leave: number;
  calculation_details: string;
}

/**
 * Calculate working days in a month (excluding weekends)
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const date = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  let workingDays = 0;

  for (let day = 1; day <= lastDay; day++) {
    date.setDate(day);
    const dayOfWeek = date.getDay();
    // Count Monday (1) to Friday (5) as working days
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }

  return workingDays;
}

/**
 * Calculate unpaid leave days within a specific month
 */
export function calculateUnpaidLeaveDaysInMonth(
  leaveRequests: LeaveRequest[],
  payrollMonth: string // Format: YYYY-MM
): number {
  const [year, month] = payrollMonth.split('-').map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  let totalUnpaidDays = 0;

  for (const leave of leaveRequests) {
    // Only count approved unpaid leave
    if (leave.status !== 'approved' || leave.leave_type !== 'unpaid') {
      continue;
    }

    const leaveStart = new Date(leave.start_date);
    const leaveEnd = new Date(leave.end_date);

    // Check if leave overlaps with payroll month
    if (leaveEnd < monthStart || leaveStart > monthEnd) {
      continue;
    }

    // Calculate overlap period
    const overlapStart = leaveStart > monthStart ? leaveStart : monthStart;
    const overlapEnd = leaveEnd < monthEnd ? leaveEnd : monthEnd;

    // Count working days in overlap period
    const current = new Date(overlapStart);
    let daysInMonth = 0;

    while (current <= overlapEnd) {
      const dayOfWeek = current.getDay();
      // Count only working days (Monday-Friday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysInMonth++;
      }
      current.setDate(current.getDate() + 1);
    }

    totalUnpaidDays += daysInMonth;
  }

  return totalUnpaidDays;
}

/**
 * Calculate salary deduction for unpaid leave
 */
export function calculateLeaveDeduction(
  grossSalary: number,
  basicSalary: number,
  unpaidDaysInMonth: number,
  payrollMonth: string
): LeaveDeductionResult {
  const [year, month] = payrollMonth.split('-').map(Number);
  const workingDaysInMonth = getWorkingDaysInMonth(year, month);

  if (unpaidDaysInMonth === 0 || workingDaysInMonth === 0) {
    return {
      unpaid_days: 0,
      deduction_amount: 0,
      working_days_in_month: workingDaysInMonth,
      days_on_unpaid_leave: unpaidDaysInMonth,
      calculation_details: 'No unpaid leave taken this month',
    };
  }

  // Calculate daily rate based on gross salary
  const dailyRate = grossSalary / workingDaysInMonth;
  const deductionAmount = dailyRate * unpaidDaysInMonth;

  const calculation_details = `Unpaid Leave Deduction: ${unpaidDaysInMonth} days out of ${workingDaysInMonth} working days. Daily rate: ₦${dailyRate.toFixed(2)}`;

  return {
    unpaid_days: unpaidDaysInMonth,
    deduction_amount: Math.round(deductionAmount),
    working_days_in_month: workingDaysInMonth,
    days_on_unpaid_leave: unpaidDaysInMonth,
    calculation_details,
  };
}

/**
 * Get all approved leave for a staff member in a specific month
 * V2.0 - Uses backend API instead of IndexedDB
 */
export async function getStaffLeaveInMonth(
  staffId: string,
  payrollMonth: string
): Promise<LeaveRequest[]> {
  const [year, month] = payrollMonth.split('-').map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  // Call backend API to get leave requests
  const API_BASE_URL = (import.meta.env?.VITE_API_URL as string) || 'http://localhost:3000/api/v1';
  const response = await fetch(`${API_BASE_URL}/leave/requests?staffId=${staffId}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('jsc_auth_token') || ''}`,
    },
  });

  if (!response.ok) {
    console.error('Failed to fetch leave requests');
    return [];
  }

  const jsonResponse = await response.json();
  const allLeave: LeaveRequest[] = Array.isArray(jsonResponse) ? jsonResponse : (jsonResponse.data || []);

  return allLeave.filter(leave => {
    if (leave.status !== 'approved') return false;

    const leaveStart = new Date(leave.start_date);
    const leaveEnd = new Date(leave.end_date);

    // Check if leave overlaps with payroll month
    return !(leaveEnd < monthStart || leaveStart > monthEnd);
  });
}

/**
 * Format leave summary for payslip
 */
export function formatLeaveSummary(leaveRequests: LeaveRequest[], payrollMonth: string): string {
  if (leaveRequests.length === 0) {
    return 'No leave taken this month';
  }

  const unpaidLeave = leaveRequests.filter(l => l.leave_type === 'unpaid');
  const paidLeave = leaveRequests.filter(l => l.leave_type !== 'unpaid');

  const summary: string[] = [];

  if (paidLeave.length > 0) {
    const types = paidLeave.map(l => l.leave_type.replace('_', ' ')).join(', ');
    const days = paidLeave.reduce((sum, l) => sum + l.number_of_days, 0);
    summary.push(`Paid Leave: ${days} days (${types})`);
  }

  if (unpaidLeave.length > 0) {
    const days = unpaidLeave.reduce((sum, l) => sum + l.number_of_days, 0);
    summary.push(`Unpaid Leave: ${days} days`);
  }

  return summary.join(' | ');
}