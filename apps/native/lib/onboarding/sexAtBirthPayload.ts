/**
 * Sex at birth payload builder for onboarding step 2.
 * Pure TypeScript; no UI imports.
 */

import type { SexAtBirth } from '../validation/sexAtBirth';

export function buildSexAtBirthPayload(value: SexAtBirth): { gender: SexAtBirth } {
  return { gender: value };
}
