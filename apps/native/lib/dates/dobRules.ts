import { POLICY } from "@/constants/constraints";

const MIN_AGE_YEARS = POLICY.DOB.MIN_AGE_YEARS;
const MAX_AGE_YEARS = POLICY.DOB.MAX_AGE_YEARS;

export function formatDob(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDob(dob: string): Date | null {
  if (!dob) return null;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dob)) return null;
  const date = new Date(dob + "T00:00:00");
  return isNaN(date.getTime()) ? null : date;
}

export function getDobMinDate(): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() - MAX_AGE_YEARS);
  return date;
}

export function getDobMaxDate(): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() - MIN_AGE_YEARS);
  return date;
}

export function getAgeFromDob(dob: string): number | null {
  const dobDate = parseDob(dob);
  if (!dobDate) return null;
  return Math.floor((Date.now() - dobDate.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export function validateDob(dob: string): { ok: boolean; errorKey?: string } {
  if (!dob || dob.trim().length === 0) {
    return { ok: false, errorKey: "onboarding.name_age.error_dob_required" };
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dob)) {
    return { ok: false, errorKey: "onboarding.name_age.error_dob_format" };
  }

  const dobDate = new Date(dob + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dobDate > today) {
    return { ok: false, errorKey: "onboarding.name_age.error_dob_future" };
  }

  const age = Math.floor((Date.now() - dobDate.getTime()) / (365.25 * 24 * 3600 * 1000));

  if (age < MIN_AGE_YEARS) {
    return { ok: false, errorKey: "onboarding.name_age.error_age_minimum" };
  }

  if (age > MAX_AGE_YEARS) {
    return { ok: false, errorKey: "onboarding.name_age.error_age_maximum" };
  }

  return { ok: true };
}
