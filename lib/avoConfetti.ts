export function avoConfetti(run: () => void) {
  // 1) Preserve existing visual behavior by running the provided callback.
  try {
    run();
  } catch {
    // If the visual confetti fails for any reason, do not block or throw.
  }

  // 2) Notify native wrapper (if running inside ReactNativeWebView).
  try {
    const rn = (window as any)?.ReactNativeWebView;
    if (rn?.postMessage) {
      rn.postMessage(
        JSON.stringify({
          type: 'AVO_CONFETTI',
          ts: Date.now(),
        })
      );
    }
  } catch {
    // Fail silently if postMessage is unavailable or throws.
  }
}

