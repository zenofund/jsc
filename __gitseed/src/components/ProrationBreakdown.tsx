import React from 'react';
import { Calendar, TrendingUp, DollarSign, Award } from 'lucide-react';
import { ProrationResult } from '../lib/proration-calculator';

interface ProrationBreakdownProps {
  proration: ProrationResult;
}

export function ProrationBreakdown({ proration }: ProrationBreakdownProps) {
  if (!proration.is_prorated) {
    return null;
  }

  const isPromotionProration = proration.promotion_date && proration.period1_amount && proration.period2_amount;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-5 h-5 text-blue-600" />
        <h3 className="text-sm text-blue-900">
          {isPromotionProration ? 'Split-Period Promotion Calculation' : 'Prorated Salary Calculation'}
        </h3>
      </div>

      {/* Proration Reason Badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        {proration.employment_date && (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full">
            <TrendingUp className="w-3 h-3" />
            New Hire: {new Date(proration.employment_date).toLocaleDateString()}
          </span>
        )}
        {proration.promotion_date && (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
            <Award className="w-3 h-3" />
            Promoted: {new Date(proration.promotion_date).toLocaleDateString()}
          </span>
        )}
        {proration.exit_date && (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 text-xs rounded-full">
            <Calendar className="w-3 h-3" />
            Exit: {new Date(proration.exit_date).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Split-Period Details (for Promotions) */}
      {isPromotionProration ? (
        <div className="space-y-3">
          {/* Period 1 */}
          <div className="bg-white rounded-lg p-3 border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600">Period 1 (Before Promotion)</span>
              <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                {proration.period1_days} working days
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Old Salary Rate</span>
              <span className="text-sm">₦{proration.period1_amount?.toLocaleString()}</span>
            </div>
          </div>

          {/* Period 2 */}
          <div className="bg-white rounded-lg p-3 border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600">Period 2 (After Promotion)</span>
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                {proration.period2_days} working days
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">New Salary Rate</span>
              <span className="text-sm text-green-600">₦{proration.period2_amount?.toLocaleString()}</span>
            </div>
          </div>

          {/* Total */}
          <div className="bg-blue-100 rounded-lg p-3 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Total for Month</span>
              <span className="text-xs px-2 py-1 bg-white rounded">
                {proration.actual_days_worked} of {proration.working_days_in_month} working days
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Blended Amount</span>
              <span className="text-sm">₦{proration.prorated_amount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Regular Proration Details */
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Working days in month:</span>
            <span className="font-medium">{proration.working_days_in_month} days</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Actual days worked:</span>
            <span className="font-medium">{proration.actual_days_worked} days</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Proration factor:</span>
            <span className="font-medium">{(proration.proration_factor * 100).toFixed(1)}%</span>
          </div>
          <div className="border-t border-blue-200 pt-2 mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Original amount:</span>
              <span className="line-through text-gray-500">₦{proration.original_amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-800">Prorated amount:</span>
              <span className="text-blue-600">₦{proration.prorated_amount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Calculation Details */}
      <div className="mt-3 pt-3 border-t border-blue-200">
        <p className="text-xs text-gray-600 whitespace-pre-line">{proration.calculation_details}</p>
      </div>
    </div>
  );
}
