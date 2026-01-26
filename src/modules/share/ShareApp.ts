import { showAppToast } from '@/components/ui/app-toast';

type ShareData = { title?: string; text?: string; url?: string };

function getAppBaseUrl(): string {
  // Prefer a configured app URL if provided at build-time; otherwise use the current web origin.
  // Share should use production URL (e.g. https://avovibe.app/) even when running on localhost,
  // so set EXPO_PUBLIC_APP_BASE_URL accordingly in your env.
  const configured = process.env.EXPO_PUBLIC_APP_BASE_URL;

  const trimmed = configured?.trim();
  if (trimmed) return trimmed.replace(/\/+$/g, '') + '/';

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/g, '') + '/';
  }

  return '';
}

function isUserCancelError(err: unknown): boolean {
  // Web Share API user cancel commonly throws AbortError (DOMException).
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as any;
  const name = typeof anyErr.name === 'string' ? anyErr.name : '';
  const message = typeof anyErr.message === 'string' ? anyErr.message : '';
  const m = message.toLowerCase();
  return (
    name === 'AbortError' ||
    m.includes('aborterror') ||
    m.includes('cancel') ||
    m.includes('canceled') ||
    m.includes('cancelled')
  );
}

async function copyToClipboard(text: string): Promise<void> {
  // 1) Modern async clipboard API (requires secure context / permissions).
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to legacy copy attempt.
    }
  }

  // 2) Legacy fallback.
  if (typeof document !== 'undefined') {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', 'true');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}

export async function shareApp(): Promise<void> {
  const shareUrl = getAppBaseUrl();
  if (!shareUrl) return;

  const shareData: ShareData = {
    title: 'AvoVibe',
    text: 'I’m tracking food and calories with AvoVibe',
    url: shareUrl,
  };

  if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
    let didShare = false;
    try {
      // Always pass title + text + url (some share sheets only preview the URL,
      // but the text is still delivered to targets like Messages/WhatsApp).
      await (navigator as any).share(shareData);
      didShare = true;
    } catch (err) {
      if (isUserCancelError(err)) return;
      // If share exists but fails (unsupported context, permissions, etc.), fall back to copying.
    }
    if (didShare) return;
  }

  await copyToClipboard(shareUrl);
  showAppToast('Link copied');
}

