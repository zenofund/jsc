import React from 'react';
import { Building2, Users, DollarSign, TrendingUp, Calendar, CheckCircle, XCircle } from 'lucide-react';
import type { CooperativeMember, Cooperative } from '../types/entities';

interface CooperativeMembershipCardProps {
  membership: CooperativeMember;
  cooperative?: Cooperative;
  showDetails?: boolean;
  onClick?: () => void;
}

export function CooperativeMembershipCard({ 
  membership, 
  cooperative,
  showDetails = true,
  onClick 
}: CooperativeMembershipCardProps) {
  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    suspended: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  const statusIcons: Record<string, any> = {
    active: CheckCircle,
    inactive: XCircle,
    suspended: XCircle,
  };

  const StatusIcon = statusIcons[membership.status];

  return (
    <div 
      onClick={onClick}
      className={`rounded-lg border border-border bg-card p-4 transition-all ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-primary' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm text-card-foreground">{membership.cooperative_name}</h3>
            <p className="text-xs text-muted-foreground">Member #{membership.member_number}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusColors[membership.status]}`}>
          <StatusIcon className="w-3 h-3" />
          {membership.status}
        </span>
      </div>

      {showDetails && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="w-3 h-3" />
              Monthly Contribution
            </div>
            <p className="text-sm text-card-foreground">₦{membership.monthly_contribution.toLocaleString()}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              Total Contributions
            </div>
            <p className="text-sm text-card-foreground">₦{membership.total_contributions.toLocaleString()}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              Shares Owned
            </div>
            <p className="text-sm text-card-foreground">{membership.shares_owned} shares</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="w-3 h-3" />
              Share Capital
            </div>
            <p className="text-sm text-card-foreground">₦{membership.total_share_capital.toLocaleString()}</p>
          </div>

          {membership.outstanding_loan_balance > 0 && (
            <div className="col-span-2 pt-2 border-t border-border">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <DollarSign className="w-3 h-3" />
                Outstanding Loan Balance
              </div>
              <p className="text-sm text-red-600 dark:text-red-400">
                ₦{membership.outstanding_loan_balance.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}

      {cooperative && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Interest Rate:</span>
              <span className="ml-1 text-card-foreground">{cooperative.interest_rate_on_loans}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Max Multiplier:</span>
              <span className="ml-1 text-card-foreground">{cooperative.maximum_loan_multiplier}x</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}