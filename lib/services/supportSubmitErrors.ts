export type SupportSubmitErrorKind = 'rate_limit' | 'duplicate' | 'auth' | 'unknown';

export type SupportSubmitError = {
  kind: SupportSubmitErrorKind;
  /**
   * Raw Supabase (or other) error for dev logging only.
   * Never show raw error content to users.
   */
  raw?: unknown;
};

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function getTokenHaystack(error: unknown): string {
  if (!error) return '';

  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message ?? '';

  if (typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const parts = [
      pickString(e.message),
      pickString(e.details),
      pickString(e.hint),
      pickString(e.code),
    ].filter(Boolean) as string[];
    return parts.join(' ');
  }

  return '';
}

/**
 * Single source of truth for mapping the create_case RPC error into a UI-safe kind.
 * Substring matching is allowed here, but should NOT be duplicated in UI.
 */
export function mapCreateCaseRpcErrorToKind(error: unknown): SupportSubmitErrorKind {
  const haystack = getTokenHaystack(error).toLowerCase();

  if (haystack.includes('rate_limit_exceeded')) return 'rate_limit';
  if (haystack.includes('duplicate_case')) return 'duplicate';

  // Prefer exact token, but accept common variants as a safety net.
  if (haystack.includes('not_authenticated') || haystack.includes('not authenticated')) return 'auth';
  if (haystack.includes('user not authenticated')) return 'auth';

  return 'unknown';
}

export function isSupportSubmitError(error: unknown): error is SupportSubmitError {
  if (!error || typeof error !== 'object') return false;
  const e = error as Record<string, unknown>;
  return (
    typeof e.kind === 'string' &&
    (e.kind === 'rate_limit' || e.kind === 'duplicate' || e.kind === 'auth' || e.kind === 'unknown')
  );
}

