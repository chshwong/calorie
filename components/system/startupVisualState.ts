import { loadingQuotes } from '@/i18n/quotes/loadingQuotes';

const STARTUP_TAGLINE_KEY = '__AVO_STARTUP_TAGLINE__';
const STARTUP_TAGLINE_SESSION_KEY = 'avovibe_startup_tagline';
const STARTUP_MASCOT_READY_KEY = '__AVO_STARTUP_MASCOT_READY__';

function readFromServerRenderedDom(): string | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById('startup-quote');
  const text = el?.textContent?.trim();
  if (!text) return null;
  return loadingQuotes.includes(text) ? text : null;
}

function readFromSessionStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage?.getItem(STARTUP_TAGLINE_SESSION_KEY);
    if (!stored) return null;
    return loadingQuotes.includes(stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeToSessionStorage(tagline: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.setItem(STARTUP_TAGLINE_SESSION_KEY, tagline);
  } catch {
    // ignore session storage errors
  }
}

export function getStartupTagline(): string {
  const globalStore = globalThis as Record<string, unknown>;
  const cached = globalStore[STARTUP_TAGLINE_KEY];

  if (typeof cached === 'string') {
    return cached;
  }

  if (loadingQuotes.length === 0) {
    globalStore[STARTUP_TAGLINE_KEY] = '';
    return '';
  }

  // On web hydration, prefer already-rendered server quote to avoid first-paint swaps.
  const domQuote = readFromServerRenderedDom();
  if (domQuote) {
    globalStore[STARTUP_TAGLINE_KEY] = domQuote;
    writeToSessionStorage(domQuote);
    return domQuote;
  }

  const storedQuote = readFromSessionStorage();
  if (storedQuote) {
    globalStore[STARTUP_TAGLINE_KEY] = storedQuote;
    return storedQuote;
  }

  const selected = loadingQuotes[Math.floor(Math.random() * loadingQuotes.length)];
  globalStore[STARTUP_TAGLINE_KEY] = selected;
  writeToSessionStorage(selected);
  return selected;
}

export function isStartupMascotReady(): boolean {
  const globalStore = globalThis as Record<string, unknown>;
  return globalStore[STARTUP_MASCOT_READY_KEY] === true;
}

export function markStartupMascotReady(): void {
  const globalStore = globalThis as Record<string, unknown>;
  globalStore[STARTUP_MASCOT_READY_KEY] = true;
}
