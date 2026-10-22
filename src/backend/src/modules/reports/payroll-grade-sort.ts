type PayrollGradeStep = {
  grade_level?: string | number | null;
  step?: string | number | null;
  staff_number?: string | null;
};

function parseGrade(value: PayrollGradeStep['grade_level']) {
  const grade = String(value ?? '').trim().replace(/^GL\s*/i, '');
  const category = grade.match(/^CAT\s*(\d+)/i);
  if (category) {
    return { rank: 2, value: Number(category[1]) || 0 };
  }

  const numericGrade = grade.match(/\d+/);
  return numericGrade
    ? { rank: 1, value: Number(numericGrade[0]) || 0 }
    : { rank: 0, value: 0 };
}

function parseStep(value: PayrollGradeStep['step']) {
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : Number.NEGATIVE_INFINITY;
}

export function comparePayrollGradeAndStep(a: PayrollGradeStep, b: PayrollGradeStep) {
  const gradeA = parseGrade(a.grade_level);
  const gradeB = parseGrade(b.grade_level);
  if (gradeA.rank !== gradeB.rank) return gradeB.rank - gradeA.rank;
  if (gradeA.value !== gradeB.value) return gradeB.value - gradeA.value;

  const stepA = parseStep(a.step);
  const stepB = parseStep(b.step);
  if (stepA !== stepB) return stepB - stepA;

  return String(a.staff_number || '').localeCompare(String(b.staff_number || ''));
}
