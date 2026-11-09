export const REQUIRED_PROFILE_FIELDS = [
  'full_name',
  'phone',
  'birth_date',
  'gender',
] as const;

export type ProfileRequiredFields = {
  full_name?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  gender?: string | null;
};

export function normalizeText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizePhone(value: string | null | undefined) {
  return normalizeText(value).replace(/\s+/g, ' ');
}

export function isValidPhone(value: string | null | undefined) {
  const normalized = normalizePhone(value);
  const digitCount = (normalized.match(/\d/g) ?? []).length;

  return (
    normalized.length > 0 &&
    digitCount >= 3 &&
    /^[\d+().\-\s]+$/.test(normalized)
  );
}

export function isValidBirthDate(value: string | null | undefined) {
  const normalized = normalizeText(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= daysInMonth[month - 1];
}

export function isProfileComplete(profile: ProfileRequiredFields | null | undefined) {
  return Boolean(
    profile &&
      normalizeText(profile.full_name) &&
      isValidPhone(profile.phone) &&
      isValidBirthDate(profile.birth_date) &&
      normalizeText(profile.gender),
  );
}
