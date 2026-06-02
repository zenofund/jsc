import type { Staff } from '../types/entities';

type StaffNameSource = Partial<Staff> & {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  surname?: string;
  other_names?: string;
  full_name?: string;
  staff_name?: string;
};

export function joinNameParts(parts: Array<string | undefined | null>) {
  return parts
    .map((p) => String(p ?? '').trim())
    .filter((p) => p.length > 0)
    .join(' ');
}

export function formatStaffName(source: StaffNameSource) {
  const first = source.first_name ?? source.bio_data?.first_name;
  const middle = source.other_names ?? source.middle_name ?? source.bio_data?.middle_name;
  const last = source.surname ?? source.last_name ?? source.bio_data?.last_name;
  const full = joinNameParts([first, middle, last]);
  return full || String(source.full_name || source.staff_name || '').trim() || 'Unknown Staff';
}

export function formatStaffFirstLastName(source: StaffNameSource) {
  const first = source.first_name ?? source.bio_data?.first_name;
  const last = source.last_name ?? source.surname ?? source.bio_data?.last_name;
  return joinNameParts([first, last]) || 'Unknown Staff';
}

export function formatStaffLabelWithId(source: StaffNameSource, staffNumber?: string) {
  const staffId = staffNumber || source.staff_number || 'N/A';
  return `${formatStaffName(source)} (${staffId})`;
}
