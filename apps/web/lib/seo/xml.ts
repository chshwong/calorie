export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const CACHE_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control":
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
} as const;
