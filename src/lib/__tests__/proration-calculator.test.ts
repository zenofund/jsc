/**
 * Comprehensive Proration Calculator Tests
 * Tests all proration scenarios including harmonious integration
 */

import {
  calculateProration,
  calculatePromotionSplitPeriod,
  applyPromotionProrationToSalaryComponents,
  needsProration,
  getProrationBadgeText,
  ProrationResult,
  PromotionData,
} from '../proration-calculator';

describe('Proration Calculator - All Scenarios', () => {
  
  // ========== BASIC PRORATION TESTS ==========
  
  describe('1. Mid-Month Resumption (New Hire)', () => {
    it('should calculate prorated salary for staff joining mid-month', () => {
      const result = calculateProration(
        150000, // Basic salary
        '2025-06', // June 2025
        '2025-06-15' // Joined June 15
      );

      expect(result.is_prorated).toBe(true);
      expect(result.proration_reason).toBe('new_hire');
      expect(result.actual_days_worked).toBeLessThan(result.working_days_in_month);
    });
  });

  describe('2. Mid-Month Exit', () => {
    it('should calculate prorated salary for staff leaving mid-month', () => {
      const result = calculateProration(
        180000, // Basic salary
        '2025-06', // June 2025
        undefined, // No employment date
        '2025-06-20' // Exit June 20
      );

      expect(result.is_prorated).toBe(true);
      expect(result.proration_reason).toBe('mid_month_exit');
      expect(result.actual_days_worked).toBeLessThan(result.working_days_in_month);
    });
  });

  describe('3. Mid-Month Promotion (Split-Period)', () => {
    it('should calculate split-period salary for staff promoted mid-month', () => {
      const promotionData: PromotionData = {
        promotion_date: '2025-06-15',
        previous_basic_salary: 150000,
        previous_grade_level: 7,
        previous_step: 3,
      };

      const result = calculatePromotionSplitPeriod(
        180000, // New basic salary
        '2025-06',
        promotionData
      );

      expect(result.is_prorated).toBe(true);
      expect(result.proration_reason).toBe('promotion');
      expect(result.period1_amount).toBeDefined();
      expect(result.period2_amount).toBeDefined();
      expect(result.period1_days).toBeGreaterThan(0);
      expect(result.period2_days).toBeGreaterThan(0);
      expect(result.prorated_amount).toBe(
        (result.period1_amount || 0) + (result.period2_amount || 0)
      );
    });
  });

  // ========== COMBINED SCENARIOS ==========

  describe('4. New Hire + Promotion (Same Month)', () => {
    it('should handle staff joining and getting promoted in same month', () => {
      const promotionData: PromotionData = {
        promotion_date: '2025-06-20',
        previous_basic_salary: 120000,
        previous_grade_level: 6,
        previous_step: 2,
      };

      const result = calculatePromotionSplitPeriod(
        150000, // New salary after promotion
        '2025-06',
        promotionData,
        '2025-06-05' // Joined June 5
      );

      expect(result.is_prorated).toBe(true);
      expect(result.proration_reason).toBe('combined');
      expect(result.employment_date).toBe('2025-06-05');
      expect(result.promotion_date).toBe('2025-06-20');
      
      // Period 1: June 5-19 at old salary
      // Period 2: June 20-30 at new salary
      expect(result.period1_days).toBeGreaterThan(0);
      expect(result.period2_days).toBeGreaterThan(0);
    });
  });

  describe('5. Promotion + Exit (Same Month)', () => {
    it('should handle staff promoted then leaving in same month', () => {
      const promotionData: PromotionData = {
        promotion_date: '2025-06-10',
        previous_basic_salary: 140000,
        previous_grade_level: 7,
        previous_step: 1,
      };

      const result = calculatePromotionSplitPeriod(
        170000, // New salary
        '2025-06',
        promotionData,
        undefined, // Not new hire
        '2025-06-25' // Exit June 25
      );

      expect(result.is_prorated).toBe(true);
      expect(result.proration_reason).toBe('combined');
      expect(result.promotion_date).toBe('2025-06-10');
      expect(result.exit_date).toBe('2025-06-25');
      
      // Period 1: June 1-9 at old salary
      // Period 2: June 10-25 at new salary
      expect(result.period1_days).toBeGreaterThan(0);
      expect(result.period2_days).toBeGreaterThan(0);
      expect(result.actual_days_worked).toBe(
        (result.period1_days || 0) + (result.period2_days || 0)
      );
    });
  });

  describe('6. Join + Promote + Exit (All Same Month)', () => {
    it('should handle staff joining, promoted, and exiting all in one month', () => {
      const promotionData: PromotionData = {
        promotion_date: '2025-06-15',
        previous_basic_salary: 130000,
      };

      const result = calculatePromotionSplitPeriod(
        160000, // New salary
        '2025-06',
        promotionData,
        '2025-06-05', // Joined June 5
        '2025-06-25'  // Exit June 25
      );

      expect(result.is_prorated).toBe(true);
      expect(result.proration_reason).toBe('combined');
      expect(result.employment_date).toBe('2025-06-05');
      expect(result.promotion_date).toBe('2025-06-15');
      expect(result.exit_date).toBe('2025-06-25');
      
      // Period 1: June 5-14 at old salary
      // Period 2: June 15-25 at new salary
      expect(result.period1_days).toBeGreaterThan(0);
      expect(result.period2_days).toBeGreaterThan(0);
      expect(result.prorated_amount).toBeLessThan(160000); // Highly prorated
    });
  });

  // ========== EDGE CASES ==========

  describe('7. Promotion on 1st of Month (No Proration)', () => {
    it('should not prorate if promotion is on first day of month', () => {
      const promotionData: PromotionData = {
        promotion_date: '2025-06-01',
        previous_basic_salary: 150000,
      };

      const result = calculatePromotionSplitPeriod(
        180000,
        '2025-06',
        promotionData
      );

      // Since promotion is on 1st, period1 should have 0 days
      expect(result.period1_days).toBe(0);
      expect(result.period2_days).toBeGreaterThan(0);
    });
  });

  describe('8. Promotion Outside Current Month', () => {
    it('should not apply promotion proration if promotion date is in different month', () => {
      const promotionData: PromotionData = {
        promotion_date: '2025-07-15', // July (payroll is for June)
        previous_basic_salary: 150000,
      };

      const result = calculatePromotionSplitPeriod(
        180000,
        '2025-06', // June payroll
        promotionData
      );

      // Should fall back to regular calculation (no proration)
      expect(result.is_prorated).toBe(false);
    });
  });

  // ========== ALLOWANCES WITH PROMOTION ==========

  describe('9. Allowances with Promotion Split-Period', () => {
    it('should split allowances between old and new rates', () => {
      const promotionData: PromotionData = {
        promotion_date: '2025-06-15',
        previous_basic_salary: 150000,
        previous_grade_level: 7,
        previous_step: 3,
      };

      const previousAllowances = [
        { code: 'TRANS', name: 'Transport', amount: 30000, is_taxable: true },
        { code: 'HOUSE', name: 'Housing', amount: 40000, is_taxable: true },
      ];

      const currentAllowances = [
        { code: 'TRANS', name: 'Transport', amount: 35000, is_taxable: true },
        { code: 'HOUSE', name: 'Housing', amount: 50000, is_taxable: true },
        { code: 'RESP', name: 'Responsibility', amount: 20000, is_taxable: true }, // New allowance
      ];

      const result = applyPromotionProrationToSalaryComponents(
        180000,
        currentAllowances,
        previousAllowances,
        '2025-06',
        promotionData
      );

      expect(result.prorated_basic_salary).toBeGreaterThan(0);
      expect(result.prorated_allowances.length).toBe(3);
      
      // Transport: should blend old (30k) and new (35k)
      const transport = result.prorated_allowances.find(a => a.code === 'TRANS');
      expect(transport).toBeDefined();
      expect(transport!.amount).toBeGreaterThan(0);
      expect(transport!.amount).toBeLessThan(35000); // Prorated

      // Responsibility: new allowance, only period 2
      const responsibility = result.prorated_allowances.find(a => a.code === 'RESP');
      expect(responsibility).toBeDefined();
      expect(responsibility!.amount).toBeLessThan(20000); // Only period 2
    });
  });

  // ========== UTILITY FUNCTIONS ==========

  describe('10. needsProration() Helper', () => {
    it('should detect when proration is needed', () => {
      // New hire
      expect(needsProration('2025-06', '2025-06-15')).toBe(true);
      
      // Exit
      expect(needsProration('2025-06', undefined, '2025-06-20')).toBe(true);
      
      // Promotion
      const promoData: PromotionData = {
        promotion_date: '2025-06-15',
        previous_basic_salary: 150000,
      };
      expect(needsProration('2025-06', undefined, undefined, promoData)).toBe(true);
      
      // No proration needed
      expect(needsProration('2025-06')).toBe(false);
    });
  });

  describe('11. getProrationBadgeText() Helper', () => {
    it('should return correct badge text', () => {
      expect(getProrationBadgeText('new_hire')).toBe('New Hire (Prorated)');
      expect(getProrationBadgeText('mid_month_exit')).toBe('Exit (Prorated)');
      expect(getProrationBadgeText('promotion')).toBe('Promotion (Prorated)');
      expect(getProrationBadgeText('combined')).toBe('Partial Month (Prorated)');
      expect(getProrationBadgeText(null)).toBe('');
    });
  });

  // ========== WORKING DAYS CALCULATION ==========

  describe('12. Working Days Accuracy', () => {
    it('should exclude weekends when counting working days', () => {
      // June 2025 has 30 days
      // Weekends: 7-8, 14-15, 21-22, 28-29 (8 days)
      // Working days: 22 days
      
      const result = calculateProration(
        150000,
        '2025-06'
      );

      expect(result.working_days_in_month).toBe(22);
    });
  });

  // ========== CALCULATION ACCURACY ==========

  describe('13. Calculation Accuracy', () => {
    it('should calculate exact amounts with proper rounding', () => {
      const promotionData: PromotionData = {
        promotion_date: '2025-06-15',
        previous_basic_salary: 150000,
      };

      const result = calculatePromotionSplitPeriod(
        180000,
        '2025-06',
        promotionData
      );

      // Verify that period1 + period2 = total
      const calculatedTotal = (result.period1_amount || 0) + (result.period2_amount || 0);
      expect(result.prorated_amount).toBe(calculatedTotal);

      // Verify rounding (should be integers)
      expect(Number.isInteger(result.period1_amount || 0)).toBe(true);
      expect(Number.isInteger(result.period2_amount || 0)).toBe(true);
      expect(Number.isInteger(result.prorated_amount)).toBe(true);
    });
  });
});

// ========== INTEGRATION TEST SUITE ==========

describe('Integration: All Proration Types Working Together', () => {
  it('should handle complex real-world scenario', () => {
    /**
     * Real-world scenario:
     * - Staff joins on June 5, 2025 at GL6/Step2 (₦120,000)
     * - Gets promoted on June 20, 2025 to GL7/Step2 (₦150,000)
     * - Resigns on June 28, 2025
     * 
     * Expected behavior:
     * - Period 1: June 5-19 at ₦120,000 (11 working days)
     * - Period 2: June 20-28 at ₦150,000 (7 working days, then weekend)
     * - Total: 18 working days out of 22 = 81.8% of blended salary
     */

    const promotionData: PromotionData = {
      promotion_date: '2025-06-20',
      previous_basic_salary: 120000,
      previous_grade_level: 6,
      previous_step: 2,
    };

    const result = calculatePromotionSplitPeriod(
      150000, // New salary
      '2025-06',
      promotionData,
      '2025-06-05', // Join date
      '2025-06-28'  // Exit date (Saturday, so last working day is June 27)
    );

    // Verify all scenarios are detected
    expect(result.is_prorated).toBe(true);
    expect(result.proration_reason).toBe('combined');
    expect(result.employment_date).toBe('2025-06-05');
    expect(result.promotion_date).toBe('2025-06-20');
    expect(result.exit_date).toBe('2025-06-28');

    // Verify periods
    expect(result.period1_days).toBeGreaterThan(0); // June 5-19
    expect(result.period2_days).toBeGreaterThan(0); // June 20-27
    expect(result.actual_days_worked).toBeLessThan(result.working_days_in_month);

    // Verify amounts
    expect(result.period1_amount).toBeGreaterThan(0);
    expect(result.period2_amount).toBeGreaterThan(0);
    expect(result.prorated_amount).toBe(
      (result.period1_amount || 0) + (result.period2_amount || 0)
    );

    // Verify calculation details are comprehensive
    expect(result.calculation_details).toContain('Split-period promotion');
    expect(result.calculation_details).toContain('Period 1');
    expect(result.calculation_details).toContain('Period 2');

    console.log('\n=== COMPLEX SCENARIO RESULTS ===');
    console.log(`Working days in month: ${result.working_days_in_month}`);
    console.log(`Period 1 (old salary): ${result.period1_days} days = ₦${result.period1_amount?.toLocaleString()}`);
    console.log(`Period 2 (new salary): ${result.period2_days} days = ₦${result.period2_amount?.toLocaleString()}`);
    console.log(`Total: ${result.actual_days_worked} days = ₦${result.prorated_amount.toLocaleString()}`);
    console.log(`Proration factor: ${(result.proration_factor * 100).toFixed(1)}%`);
    console.log('================================\n');
  });
});
