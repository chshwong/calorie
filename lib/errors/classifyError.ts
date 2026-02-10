/**
 * Best-effort error classifier for FriendlyErrorScreen.
 * Maps common failures to themed AvoVibe copy. Unknown falls back to catch-all.
 */

export type ErrorKind = 'offline' | 'timeout' | 'server' | 'auth' | 'unknown';

export interface ClassifyErrorInput {
  error?: unknown;
  httpStatus?: number;
  isOfflineHint?: boolean;
}

export interface ClassifyErrorResult {
  kind: ErrorKind;
  title: string;
  message: string;
}

const MESSAGES: Record<ErrorKind, { title: string; message: string }> = {
  offline: {
    title: "Uh-oh, we're offline",
    message:
      "Looks like AvoVibe can't find the internet right now. Check your Wi-Fi or data, then we'll get you back on track.",
  },
  timeout: {
    title: 'This is taking a bit longer…',
    message:
      "Your connection seems slow right now. AvoVibe is waiting for things to catch up.",
  },
  server: {
    title: "Our avocado slipped 😅",
    message:
      "Something didn't go as planned on our side. We're fixing it and will be back shortly.",
  },
  auth: {
    title: 'Time to sign back in',
    message:
      "For security reasons, your session expired. Sign in again to keep logging and tracking.",
  },
  unknown: {
    title: 'Our avocado hit a small bump 🥑',
    message:
      "Something unexpected happened, but no worries — your data is safe. Let's try again and get you back on track.",
  },
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return String(error);
  } catch {
    return '';
  }
}

export function classifyError(input: ClassifyErrorInput): ClassifyErrorResult {
  const { error, httpStatus, isOfflineHint } = input;
  const msg = getErrorMessage(error).toLowerCase();

  if (isOfflineHint === true) {
    return { kind: 'offline', ...MESSAGES.offline };
  }

  if (httpStatus === 401 || msg.includes('invalid jwt') || msg.includes('session') || msg.includes('expired')) {
    return { kind: 'auth', ...MESSAGES.auth };
  }

  if (httpStatus !== undefined && httpStatus >= 500) {
    return { kind: 'server', ...MESSAGES.server };
  }

  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('etimedout') ||
    msg.includes('exceeded')
  ) {
    return { kind: 'timeout', ...MESSAGES.timeout };
  }

  return { kind: 'unknown', ...MESSAGES.unknown };
}
