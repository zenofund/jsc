import { comparePayrollGradeAndStep } from './payroll-grade-sort';

describe('comparePayrollGradeAndStep', () => {
  it('sorts category grades first, then numeric grades and steps descending', () => {
    const staff = [
      { grade_level: 'GL 3', step: 4 },
      { grade_level: 'CAT1', step: 1 },
      { grade_level: 'GL 17', step: 8 },
      { grade_level: 'CAT4', step: 4 },
      { grade_level: 'GL 17', step: 9 },
      { grade_level: 'CAT1', step: 4 },
    ];

    expect(staff.sort(comparePayrollGradeAndStep)).toEqual([
      { grade_level: 'CAT4', step: 4 },
      { grade_level: 'CAT1', step: 4 },
      { grade_level: 'CAT1', step: 1 },
      { grade_level: 'GL 17', step: 9 },
      { grade_level: 'GL 17', step: 8 },
      { grade_level: 'GL 3', step: 4 },
    ]);
  });
});
