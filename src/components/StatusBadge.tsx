import React from 'react';

type BadgeStatus = 
  | 'pending' 
  | 'in_review' 
  | 'pending_review'
  | 'pending_approval'
  | 'approved' 
  | 'rejected' 
  | 'paid' 
  | 'processed'
  | 'ready_for_payment'
  | 'locked'
  | 'draft'
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'on_leave'
  | 'retired'
  | 'terminated'
  | 'resigned'
  | 'secondment'
  | 'interdiction'
  | 'cancelled'
  | 'expired'
  | 'open'
  | 'investigating'
  | 'resolved'
  | 'closed';

interface StatusBadgeProps {
  status: BadgeStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<BadgeStatus, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900' },
    pending_review: { label: 'Pending Review', className: 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900' },
    in_review: { label: 'In Review', className: 'bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-900' },
    pending_approval: { label: 'Pending Approval', className: 'bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-900' },
    approved: { label: 'Approved', className: 'bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-900' },
    rejected: { label: 'Rejected', className: 'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-400 border-red-200 dark:border-red-900' },
    paid: { label: 'Paid', className: 'bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-900' },
    processed: { label: 'Processed', className: 'bg-purple-100 dark:bg-purple-950/30 text-purple-800 dark:text-purple-400 border-purple-200 dark:border-purple-900' },
    ready_for_payment: { label: 'Ready for Payment', className: 'bg-teal-100 dark:bg-teal-950/30 text-teal-800 dark:text-teal-400 border-teal-200 dark:border-teal-900' },
    locked: { label: 'Locked', className: 'bg-muted/50 text-muted-foreground border-border' },
    draft: { label: 'Draft', className: 'bg-muted/30 text-muted-foreground border-border' },
    active: { label: 'Active', className: 'bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-900' },
    inactive: { label: 'Inactive', className: 'bg-muted/30 text-muted-foreground border-border' },
    suspended: { label: 'Suspended', className: 'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-400 border-red-200 dark:border-red-900' },
    on_leave: { label: 'On Leave', className: 'bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-900' },
    retired: { label: 'Retired', className: 'bg-gray-100 dark:bg-gray-950/30 text-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-900' },
    terminated: { label: 'Terminated', className: 'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-400 border-red-200 dark:border-red-900' },
    resigned: { label: 'Resigned', className: 'bg-gray-100 dark:bg-gray-950/30 text-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-900' },
    secondment: { label: 'Secondment', className: 'bg-indigo-100 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900' },
    interdiction: { label: 'Interdiction', className: 'bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-900' },
    cancelled: { label: 'Cancelled', className: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
    expired: { label: 'Expired', className: 'bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-900' },
    open: { label: 'Open', className: 'bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-900' },
    investigating: { label: 'Investigating', className: 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900' },
    resolved: { label: 'Resolved', className: 'bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-900' },
    closed: { label: 'Closed', className: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
}
