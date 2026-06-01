import { describe, it, expect } from 'vitest';
import type { Staff } from '../../types/entities';
import { sortStaffByHierarchy } from '../StaffListPage';

const makeStaff = (gradeLevel: string, step: number, staffNumber: string): Staff => ({
  id: staffNumber,
  staff_number: staffNumber,
  bio_data: {
    first_name: 'Test',
    last_name: 'User',
    date_of_birth: '1990-01-01',
    gender: 'male',
    state_of_origin: 'Lagos',
    lga_of_origin: 'Ikeja',
    nationality: 'Nigerian',
  },
  next_of_kin: {},
  appointment: {
    date_of_first_appointment: '2020-01-01',
    current_posting: 'HQ',
    department: 'Admin',
    designation: 'Officer',
    employment_date: '2020-01-01',
  },
  salary_info: {
    grade_level: gradeLevel,
    step,
    bank_name: 'Bank',
    account_number: '0000000000',
  },
  status: 'active',
  created_at: '2020-01-01',
  updated_at: '2020-01-01',
  created_by: 'system',
});

describe('sortStaffByHierarchy', () => {
  it('orders CAT4, CAT1, then grade levels and steps descending', () => {
    const input = [
      makeStaff('17', 7, 'S1'),
      makeStaff('CAT1', 2, 'S2'),
      makeStaff('3', 1, 'S3'),
      makeStaff('17', 9, 'S4'),
      makeStaff('CAT4', 4, 'S5'),
      makeStaff('17', 8, 'S6'),
    ];

    const result = sortStaffByHierarchy(input);
    const order = result.map((staff) => `${staff.salary_info.grade_level}/${staff.salary_info.step}`);

    expect(order).toEqual([
      'CAT4/4',
      'CAT1/2',
      '17/9',
      '17/8',
      '17/7',
      '3/1',
    ]);
  });
});
