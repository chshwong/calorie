import "react-native-url-polyfill/auto";

const RAW_WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_BASE_URL;

function normalizeWebBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  const noTrailingSlashes = trimmed.replace(/\/+$/, "");
  return noTrailingSlashes;
}

function validateWebBaseUrl(normalized: string): void {
  const isHttps = normalized.startsWith("https://");
  const isHttpDevOnly = __DEV__ && normalized.startsWith("http://");

  if (!isHttps && !isHttpDevOnly) {
    throw new Error("EXPO_PUBLIC_WEB_BASE_URL is required for native wrapper");
  }

  // `new URL()` throws for invalid URLs (missing host, etc.)
  try {
    // eslint-disable-next-line no-new
    new URL(normalized);
  } catch {
    throw new Error("EXPO_PUBLIC_WEB_BASE_URL is required for native wrapper");
  }
}

if (!RAW_WEB_BASE_URL) {
  throw new Error("EXPO_PUBLIC_WEB_BASE_URL is required for native wrapper");
}

export const WEB_BASE_URL = (() => {
  const normalized = normalizeWebBaseUrl(RAW_WEB_BASE_URL);
  validateWebBaseUrl(normalized);
  return normalized;
})();

// Default to the web app's root. The previous "/food-diary" default 404s on prod.
// You can still deep-link inside the wrapper via `/web?path=/some-path`.
export const DEFAULT_WEB_PATH = "/";

export const BLOCKED_WEB_PATH_PREFIXES = ["/login", "/auth", "/onboarding"] as const;

export type BlockedPathOptions = {
  /**
   * When true, allow `/onboarding*` paths in the WebView wrapper.
   * NOTE: `/login*` and `/auth*` are always blocked (native owns login).
   */
  allowOnboardingPaths?: boolean;
};

function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function isBlockedPath(pathname: string, options?: BlockedPathOptions): boolean {
  const normalizedPathname = normalizePathname(pathname);

  // Web login must never appear in the native wrapper.
  if (normalizedPathname.startsWith("/login") || normalizedPathname.startsWith("/auth")) {
    return true;
  }

  // Onboarding is blocked by default; only allow it on the dedicated web-onboarding route.
  if (!options?.allowOnboardingPaths && normalizedPathname.startsWith("/onboarding")) {
    return true;
  }

  return false;
}

// Back-compat with earlier naming in the instructions.
export const isBlockedWebPath = isBlockedPath;

const WEB_URL = new URL(WEB_BASE_URL);
const WEB_ORIGIN = WEB_URL.origin;

// Many sites canonicalize between apex and `www.`. Allow both to avoid opening Chrome
// for same-site redirects like avovibe.app -> www.avovibe.app.
const ALT_ORIGIN = (() => {
  const next = new URL(WEB_BASE_URL);
  const host = next.hostname;
  next.hostname = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
  return next.origin;
})();

const ALLOWED_ORIGINS = new Set([WEB_ORIGIN, ALT_ORIGIN]);

export function isSameOrigin(url: URL): boolean {
  return ALLOWED_ORIGINS.has(url.origin);
}

