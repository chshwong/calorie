export type FitbitOAuthPopupResult = {
  ok: boolean;
  errorCode: string | null;
  message: string | null;
};

type Options = {
  /** Defaults to 180s. */
  timeoutMs?: number;
  /**
   * Sender origin we accept messages from (Edge Function callback origin).
   * Example: https://<project>.functions.supabase.co
   */
  functionsOrigin: string;
  /**
   * Optional fallback check for “connected” when COOP/noopener prevents postMessage.
   * If it ever returns true, we resolve ok=true and close the popup.
   */
  pollConnected?: () => Promise<boolean>;
  pollIntervalMs?: number;
};

export function openFitbitConnectPopup(authorizeUrl: string, opts: Options): Promise<FitbitOAuthPopupResult> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({
        ok: false,
        errorCode: 'unsupported',
        message: 'Fitbit connect is only supported on web.',
      });
      return;
    }

    const timeoutMs = Math.max(5_000, opts.timeoutMs ?? 180_000);
    const pollIntervalMs = Math.max(500, opts.pollIntervalMs ?? 1_500);
    const functionsOrigin = opts.functionsOrigin.replace(/\/+$/g, '');

    const popup = window.open(authorizeUrl, 'fitbit_oauth', 'width=520,height=720');
    if (!popup) {
      resolve({
        ok: false,
        errorCode: 'popup_blocked',
        message: 'Popup was blocked. Allow popups and try again.',
      });
      return;
    }

    let settled = false;
    let closePollTimer: number | undefined;
    let connectedPollTimer: number | undefined;
    let timeoutTimer: number | undefined;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (typeof closePollTimer === 'number') window.clearInterval(closePollTimer);
      if (typeof connectedPollTimer === 'number') window.clearInterval(connectedPollTimer);
      if (typeof timeoutTimer === 'number') window.clearTimeout(timeoutTimer);
    };

    const settle = (result: FitbitOAuthPopupResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        if (popup && !popup.closed) popup.close();
      } catch {
        // ignore
      }
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      // Strict sender origin validation.
      if (event.origin !== functionsOrigin) return;

      // Strict source validation: message must come from the popup we opened.
      if (event.source !== popup) return;

      const data: any = (event as any)?.data;
      if (!data || typeof data !== 'object') return;
      if (data.type !== 'fitbit_oauth_result') return;
      if (data.provider !== 'fitbit') return;
      if (typeof data.ok !== 'boolean') return;

      settle({
        ok: data.ok,
        errorCode: typeof data.errorCode === 'string' ? data.errorCode : null,
        message: typeof data.message === 'string' ? data.message : null,
      });
    };

    // Install listener immediately (before any possible navigation completes).
    window.addEventListener('message', onMessage);

    // Timeout always resolves (never rejects/throws).
    timeoutTimer = window.setTimeout(() => {
      settle({
        ok: false,
        errorCode: 'timeout',
        message: 'Fitbit connect timed out. Please try again.',
      });
    }, timeoutMs);

    // If popup is closed without receiving a message, resolve consistently.
    closePollTimer = window.setInterval(() => {
      try {
        if (popup.closed) {
          settle({
            ok: false,
            errorCode: 'closed',
            message: 'Popup was closed before completing Fitbit connect.',
          });
        }
      } catch {
        // ignore
      }
    }, 400);

    // Optional fallback: poll for connection status (handles COOP/noopener blocking postMessage).
    if (typeof opts.pollConnected === 'function') {
      connectedPollTimer = window.setInterval(async () => {
        try {
          const ok = await opts.pollConnected?.();
          if (ok) {
            settle({ ok: true, errorCode: null, message: null });
          }
        } catch {
          // ignore transient polling failures
        }
      }, pollIntervalMs);
    }
  });
}

