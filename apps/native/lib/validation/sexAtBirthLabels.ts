/**
 * Sex at birth label mapping utilities.
 * Pure TypeScript; no UI imports.
 */

import type { SexAtBirth } from './sexAtBirth';

export function sexAtBirthToLabel(value: SexAtBirth): 'Male' | 'Female' {
  return value === 'male' ? 'Male' : 'Female';
}

export function labelToSexAtBirth(label: string): SexAtBirth | null {
  const normalized = label.trim();
  if (normalized === 'Male' || normalized === 'male') {
    return 'male';
  }
  if (normalized === 'Female' || normalized === 'female') {
    return 'female';
  }
  return null;
}
