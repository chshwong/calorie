// Vercel Serverless Function: /api/geo
// Returns a 2-letter country code based on Vercel IP geolocation headers.
//
// Expected header on Vercel: x-vercel-ip-country (e.g. "CA", "US")
// Docs: https://vercel.com/docs/edge-network/headers

function normalizeCountry(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(trimmed)) return null;
  return trimmed;
}

export default function handler(req: any, res: any) {
  const headers = req?.headers ?? {};
  const rawHeader =
    headers['x-vercel-ip-country'] ??
    headers['x-vercel-ip-country'.toLowerCase()] ??
    headers['x-vercel-ip-country'.toUpperCase()] ??
    // Fallback if you later put Cloudflare in front of Vercel
    headers['cf-ipcountry'];

  const country = normalizeCountry(Array.isArray(rawHeader) ? rawHeader[0] : rawHeader);

  // Avoid caching across users; geo depends on requester IP.
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  res.statusCode = 200;
  res.end(JSON.stringify({ country }));
}


