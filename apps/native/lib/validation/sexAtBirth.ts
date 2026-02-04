/**
 * Sex at birth validation utilities.
 * Pure TypeScript; no UI imports.
 */

export type SexAtBirth = 'male' | 'female';

export function isValidSexAtBirth(v: unknown): v is SexAtBirth {
  return v === 'male' || v === 'female';
}

export function validateSexAtBirth(v: unknown): { ok: true; value: SexAtBirth } | { ok: false; errorKey: string } {
  if (v === null || v === undefined || v === '') {
    return { ok: false, errorKey: 'onboarding.sexAtBirth.required' };
  }

  if (!isValidSexAtBirth(v)) {
    return { ok: false, errorKey: 'onboarding.sex.error_select_sex' };
  }

  return { ok: true, value: v };
}
