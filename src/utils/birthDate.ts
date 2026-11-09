import { isValidBirthDate } from './profileValidation';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// A birth date is a calendar date. Never parse YYYY-MM-DD as a UTC instant.
export function parseCalendarDate(value: string): Date | null {
  if (!isValidBirthDate(value)) return null;
  const [year, month, day] = value.trim().split('-').map(Number);
  const date = new Date(0);
  // Local noon avoids midnight DST transitions; setFullYear handles years 1–99.
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date : null;
}

export function serializeCalendarDate(date: Date): string | null {
  if (!Number.isFinite(date.getTime())) return null;
  const year = date.getFullYear();
  if (year < 1 || year > 9999) return null;
  return [String(year).padStart(4, '0'), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}

export function isAllowedBirthDate(value: string, today = new Date()): boolean {
  const maximum = serializeCalendarDate(today);
  return isValidBirthDate(value) && maximum !== null && value.trim() <= maximum;
}

export function formatBirthDate(value: string): string {
  if (!isValidBirthDate(value)) return '';
  const [year, month, day] = value.trim().split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${String(year).padStart(4, '0')}`;
}
