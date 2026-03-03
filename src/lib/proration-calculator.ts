/**
 * Prorated Salary Calculator for JSC Payroll System
 * Handles mid-month resumption, exit, and promotion scenarios
 */

export interface ProrationResult {
  is_prorated: boolean;
  working_days_in_month: number;
  actual_days_worked: number;
  proration_factor: number;
  proration_reason: 'new_hire' | 'mid_month_exit' | 'promotion' | 'combined' | null;
  employment_date?: string;
  exit_date?: string;
  promotion_date?: string;
  original_amount: number;
  prorated_amount: number;
  calculation_details: string;
  // For promotion split-period calculation
  period1_amount?: number; // Before promotion
  period2_amount?: number; // After promotion
  period1_days?: number;
  period2_days?: number;
}

export interface PromotionData {
  promotion_date: string;
  previous_basic_salary: number;
  previous_grade_level?: number;
  previous_step?: number;
}

/**
 * Calculate working days in a month (excluding Saturdays and Sundays)
 */
function getWorkingDaysInMonth(year: number, month: number): number {
  let workingDays = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    // Exclude Saturdays (6) and Sundays (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }

  return workingDays;
}

/**
 * Calculate actual working days for a staff member in a given month
 * considering their employment date and exit date
 */
function getActualWorkingDays(
  year: number,
  month: number,
  employmentDate?: string,
  exitDate?: string
): number {
  let workingDays = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Determine the start and end dates for calculation
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month, daysInMonth);

  let startDate = monthStart;
  let endDate = monthEnd;

  if (employmentDate) {
    const empDate = new Date(employmentDate);
    if (empDate > startDate) {
      startDate = empDate;
    }
  }

  if (exitDate) {
    const exDate = new Date(exitDate);
    if (exDate < endDate) {
      endDate = exDate;
    }
  }

  // Count working days between start and end dates (inclusive)
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    // Exclude Saturdays (6) and Sundays (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return workingDays;
}

/**
 * Calculate prorated salary for a staff member
 * @param amount - Original salary amount (basic salary or allowance)
 * @param payrollMonth - Payroll month in YYYY-MM format
 * @param employmentDate - Staff employment/resumption date (optional)
 * @param exitDate - Staff exit date (optional)
 * @param promotionData - Promotion data (optional)
 */
export function calculateProration(
  amount: number,
  payrollMonth: string,
  employmentDate?: string,
  exitDate?: string,
  promotionData?: PromotionData
): ProrationResult {
  // Parse payroll month
  const [yearStr, monthStr] = payrollMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1; // JavaScript months are 0-indexed

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  // Check if employment date falls within this payroll month
  let effectiveEmploymentDate: string | undefined;
  let isNewHire = false;
  if (employmentDate) {
    const empDate = new Date(employmentDate);
    if (empDate > monthStart && empDate <= monthEnd) {
      effectiveEmploymentDate = employmentDate;
      isNewHire = true;
    }
  }

  // Check if exit date falls within this payroll month
  let effectiveExitDate: string | undefined;
  let isMidMonthExit = false;
  if (exitDate) {
    const exDate = new Date(exitDate);
    if (exDate >= monthStart && exDate < monthEnd) {
      effectiveExitDate = exitDate;
      isMidMonthExit = true;
    }
  }

  // Check if promotion date falls within this payroll month
  let effectivePromotionDate: string | undefined;
  let isPromotion = false;
  if (promotionData && promotionData.promotion_date) {
    const promoDate = new Date(promotionData.promotion_date);
    if (promoDate >= monthStart && promoDate < monthEnd) {
      effectivePromotionDate = promotionData.promotion_date;
      isPromotion = true;
    }
  }

  // If no proration needed, return full amount
  if (!isNewHire && !isMidMonthExit && !isPromotion) {
    return {
      is_prorated: false,
      working_days_in_month: getWorkingDaysInMonth(year, month),
      actual_days_worked: getWorkingDaysInMonth(year, month),
      proration_factor: 1.0,
      proration_reason: null,
      original_amount: amount,
      prorated_amount: amount,
      calculation_details: 'Full month salary - No proration required',
    };
  }

  // Calculate working days
  const workingDaysInMonth = getWorkingDaysInMonth(year, month);
  const actualDaysWorked = getActualWorkingDays(
    year,
    month,
    effectiveEmploymentDate,
    effectiveExitDate
  );

  // Calculate proration factor
  const prorationFactor = actualDaysWorked / workingDaysInMonth;
  const proratedAmount = Math.round(amount * prorationFactor);

  // Determine proration reason
  let prorationReason: 'new_hire' | 'mid_month_exit' | 'promotion' | 'combined' = 'combined';
  if (isNewHire && isMidMonthExit && isPromotion) {
    prorationReason = 'combined';
  } else if (isNewHire && isMidMonthExit) {
    prorationReason = 'combined';
  } else if (isNewHire) {
    prorationReason = 'new_hire';
  } else if (isMidMonthExit) {
    prorationReason = 'mid_month_exit';
  } else if (isPromotion) {
    prorationReason = 'promotion';
  }

  // Build calculation details
  let calculationDetails = '';
  if (isNewHire && isMidMonthExit && isPromotion) {
    calculationDetails = `Prorated (New hire on ${new Date(effectiveEmploymentDate!).toLocaleDateString()} + Exit on ${new Date(effectiveExitDate!).toLocaleDateString()} + Promotion on ${new Date(effectivePromotionDate!).toLocaleDateString()}): ${actualDaysWorked}/${workingDaysInMonth} working days × ₦${amount.toLocaleString()} = ₦${proratedAmount.toLocaleString()}`;
  } else if (isNewHire && isMidMonthExit) {
    calculationDetails = `Prorated (New hire on ${new Date(effectiveEmploymentDate!).toLocaleDateString()} + Exit on ${new Date(effectiveExitDate!).toLocaleDateString()}): ${actualDaysWorked}/${workingDaysInMonth} working days × ₦${amount.toLocaleString()} = ₦${proratedAmount.toLocaleString()}`;
  } else if (isNewHire) {
    calculationDetails = `Prorated (New hire on ${new Date(effectiveEmploymentDate!).toLocaleDateString()}): ${actualDaysWorked}/${workingDaysInMonth} working days × ₦${amount.toLocaleString()} = ₦${proratedAmount.toLocaleString()}`;
  } else if (isMidMonthExit) {
    calculationDetails = `Prorated (Exit on ${new Date(effectiveExitDate!).toLocaleDateString()}): ${actualDaysWorked}/${workingDaysInMonth} working days × ₦${amount.toLocaleString()} = ₦${proratedAmount.toLocaleString()}`;
  } else if (isPromotion) {
    calculationDetails = `Prorated (Promotion on ${new Date(effectivePromotionDate!).toLocaleDateString()}): ${actualDaysWorked}/${workingDaysInMonth} working days × ₦${amount.toLocaleString()} = ₦${proratedAmount.toLocaleString()}`;
  }

  return {
    is_prorated: true,
    working_days_in_month: workingDaysInMonth,
    actual_days_worked: actualDaysWorked,
    proration_factor: prorationFactor,
    proration_reason: prorationReason,
    employment_date: effectiveEmploymentDate,
    exit_date: effectiveExitDate,
    promotion_date: effectivePromotionDate,
    original_amount: amount,
    prorated_amount: proratedAmount,
    calculation_details: calculationDetails,
  };
}

/**
 * Apply proration to salary components
 */
export function applyProrationToSalaryComponents(
  basicSalary: number,
  allowances: { code: string; name: string; amount: number; is_taxable?: boolean }[],
  payrollMonth: string,
  employmentDate?: string,
  exitDate?: string,
  promotionData?: PromotionData
): {
  prorated_basic_salary: number;
  prorated_allowances: { code: string; name: string; amount: number; is_taxable?: boolean }[];
  proration_details: ProrationResult;
} {
  // Calculate proration for basic salary
  const basicProration = calculateProration(basicSalary, payrollMonth, employmentDate, exitDate, promotionData);

  // Apply same proration factor to all allowances
  const proratedAllowances = allowances.map((allowance) => ({
    ...allowance,
    amount: Math.round(allowance.amount * basicProration.proration_factor),
  }));

  return {
    prorated_basic_salary: basicProration.prorated_amount,
    prorated_allowances: proratedAllowances,
    proration_details: basicProration,
  };
}

/**
 * Check if staff needs proration for a given payroll month
 */
export function needsProration(
  payrollMonth: string,
  employmentDate?: string,
  exitDate?: string,
  promotionData?: PromotionData
): boolean {
  if (!employmentDate && !exitDate && !promotionData) {
    return false;
  }

  const [yearStr, monthStr] = payrollMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1;

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  // Check if employment date is mid-month
  if (employmentDate) {
    const empDate = new Date(employmentDate);
    if (empDate > monthStart && empDate <= monthEnd) {
      return true;
    }
  }

  // Check if exit date is mid-month
  if (exitDate) {
    const exDate = new Date(exitDate);
    if (exDate >= monthStart && exDate < monthEnd) {
      return true;
    }
  }

  // Check if promotion date is mid-month
  if (promotionData && promotionData.promotion_date) {
    const promoDate = new Date(promotionData.promotion_date);
    if (promoDate >= monthStart && promoDate < monthEnd) {
      return true;
    }
  }

  return false;
}

/**
 * Get proration badge text for UI display
 */
export function getProrationBadgeText(
  prorationReason: 'new_hire' | 'mid_month_exit' | 'promotion' | 'combined' | null
): string {
  if (!prorationReason) return '';

  switch (prorationReason) {
    case 'new_hire':
      return 'New Hire (Prorated)';
    case 'mid_month_exit':
      return 'Exit (Prorated)';
    case 'promotion':
      return 'Promotion (Prorated)';
    case 'combined':
      return 'Partial Month (Prorated)';
    default:
      return '';
  }
}

/**
 * Calculate split-period salary for mid-month promotion
 * This handles the complex case where salary changes mid-month due to promotion
 * @param currentBasicSalary - New basic salary after promotion
 * @param payrollMonth - Payroll month in YYYY-MM format
 * @param promotionData - Promotion details
 * @param employmentDate - Employment date (optional, for new hires promoted same month)
 * @param exitDate - Exit date (optional, for staff promoted then leaving same month)
 * @returns Split-period calculation result
 */
export function calculatePromotionSplitPeriod(
  currentBasicSalary: number,
  payrollMonth: string,
  promotionData: PromotionData,
  employmentDate?: string,
  exitDate?: string
): ProrationResult {
  const [yearStr, monthStr] = payrollMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1;

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const promotionDate = new Date(promotionData.promotion_date);

  // Ensure promotion date is within the month
  if (promotionDate < monthStart || promotionDate >= monthEnd) {
    // No promotion this month, use regular proration
    return calculateProration(currentBasicSalary, payrollMonth, employmentDate, exitDate);
  }

  const workingDaysInMonth = getWorkingDaysInMonth(year, month);

  // Determine actual start and end dates considering employment/exit
  let periodStartDate = monthStart;
  let periodEndDate = monthEnd;

  if (employmentDate) {
    const empDate = new Date(employmentDate);
    if (empDate > monthStart && empDate <= monthEnd) {
      periodStartDate = empDate;
    }
  }

  if (exitDate) {
    const exDate = new Date(exitDate);
    if (exDate >= monthStart && exDate < monthEnd) {
      periodEndDate = exDate;
    }
  }

  // Calculate Period 1: From period start to day before promotion (old salary)
  const period1End = new Date(promotionDate);
  period1End.setDate(period1End.getDate() - 1);
  
  let period1Days = 0;
  if (periodStartDate <= period1End) {
    period1Days = getActualWorkingDays(year, month, periodStartDate.toISOString(), period1End.toISOString());
  }

  // Calculate Period 2: From promotion date to period end (new salary)
  let period2Days = 0;
  if (promotionDate <= periodEndDate) {
    period2Days = getActualWorkingDays(year, month, promotionDate.toISOString(), periodEndDate.toISOString());
  }

  // Calculate amounts for each period
  const previousBasicSalary = promotionData.previous_basic_salary;
  
  const period1Factor = period1Days / workingDaysInMonth;
  const period2Factor = period2Days / workingDaysInMonth;
  
  const period1Amount = Math.round(previousBasicSalary * period1Factor);
  const period2Amount = Math.round(currentBasicSalary * period2Factor);
  
  const totalAmount = period1Amount + period2Amount;
  const totalDays = period1Days + period2Days;

  // Build detailed calculation string
  const gradeInfo = promotionData.previous_grade_level && promotionData.previous_step
    ? ` (GL${promotionData.previous_grade_level}/Step${promotionData.previous_step} → GL${promotionData.previous_grade_level + 1}/Step${promotionData.previous_step})`
    : '';

  const calculationDetails = 
    `Split-period promotion${gradeInfo}:\n` +
    `• Period 1 (${periodStartDate.toLocaleDateString()} - ${period1End.toLocaleDateString()}): ${period1Days} days at ₦${previousBasicSalary.toLocaleString()} = ₦${period1Amount.toLocaleString()}\n` +
    `• Period 2 (${promotionDate.toLocaleDateString()} - ${periodEndDate.toLocaleDateString()}): ${period2Days} days at ₦${currentBasicSalary.toLocaleString()} = ₦${period2Amount.toLocaleString()}\n` +
    `• Total: ${totalDays}/${workingDaysInMonth} working days = ₦${totalAmount.toLocaleString()}`;

  // Determine combined proration reason
  let prorationReason: 'new_hire' | 'mid_month_exit' | 'promotion' | 'combined' = 'promotion';
  if (employmentDate && exitDate) {
    const empDate = new Date(employmentDate);
    const exDate = new Date(exitDate);
    if (empDate > monthStart && exDate < monthEnd) {
      prorationReason = 'combined';
    }
  } else if (employmentDate) {
    const empDate = new Date(employmentDate);
    if (empDate > monthStart) {
      prorationReason = 'combined';
    }
  } else if (exitDate) {
    const exDate = new Date(exitDate);
    if (exDate < monthEnd) {
      prorationReason = 'combined';
    }
  }

  return {
    is_prorated: true,
    working_days_in_month: workingDaysInMonth,
    actual_days_worked: totalDays,
    proration_factor: totalDays / workingDaysInMonth,
    proration_reason: prorationReason,
    employment_date: employmentDate,
    exit_date: exitDate,
    promotion_date: promotionData.promotion_date,
    original_amount: currentBasicSalary,
    prorated_amount: totalAmount,
    calculation_details: calculationDetails,
    period1_amount: period1Amount,
    period2_amount: period2Amount,
    period1_days: period1Days,
    period2_days: period2Days,
  };
}

/**
 * Apply promotion split-period proration to salary components
 * This handles allowances for promoted staff
 */
export function applyPromotionProrationToSalaryComponents(
  currentBasicSalary: number,
  currentAllowances: { code: string; name: string; amount: number; is_taxable?: boolean }[],
  previousAllowances: { code: string; name: string; amount: number; is_taxable?: boolean }[],
  payrollMonth: string,
  promotionData: PromotionData,
  employmentDate?: string,
  exitDate?: string
): {
  prorated_basic_salary: number;
  prorated_allowances: { code: string; name: string; amount: number; is_taxable?: boolean }[];
  proration_details: ProrationResult;
} {
  // Calculate split-period for basic salary
  const basicProration = calculatePromotionSplitPeriod(
    currentBasicSalary,
    payrollMonth,
    promotionData,
    employmentDate,
    exitDate
  );

  const workingDaysInMonth = basicProration.working_days_in_month;
  const period1Days = basicProration.period1_days || 0;
  const period2Days = basicProration.period2_days || 0;

  // Apply split-period to allowances
  const proratedAllowances = currentAllowances.map((currentAllowance) => {
    // Find corresponding previous allowance (if exists)
    const previousAllowance = previousAllowances.find(
      (prev) => prev.code === currentAllowance.code
    );

    let period1AllowanceAmount = 0;
    let period2AllowanceAmount = 0;

    if (period1Days > 0) {
      const period1Factor = period1Days / workingDaysInMonth;
      const oldAmount = previousAllowance?.amount || currentAllowance.amount;
      period1AllowanceAmount = Math.round(oldAmount * period1Factor);
    }

    if (period2Days > 0) {
      const period2Factor = period2Days / workingDaysInMonth;
      period2AllowanceAmount = Math.round(currentAllowance.amount * period2Factor);
    }

    const totalAmount = period1AllowanceAmount + period2AllowanceAmount;

    return {
      ...currentAllowance,
      amount: totalAmount,
    };
  });

  return {
    prorated_basic_salary: basicProration.prorated_amount,
    prorated_allowances: proratedAllowances,
    proration_details: basicProration,
  };
}