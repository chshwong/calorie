import { useQuery } from '@tanstack/react-query';

type GeoResponse = {
  country: string | null;
};

function normalizeCountry(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(trimmed)) return null;
  return trimmed;
}

async function fetchGeoCountry(): Promise<string | null> {
  const res = await fetch('/api/geo', { method: 'GET', cache: 'no-store' });
  if (!res.ok) return null;
  const data: GeoResponse | null = await res.json().catch(() => null);
  return normalizeCountry(data?.country);
}

export function useGeoCountry(options: { enabled: boolean }) {
  return useQuery({
    queryKey: ['geoCountry'],
    queryFn: fetchGeoCountry,
    enabled: options.enabled,
    // Geo can change when traveling; keep it reasonably fresh and don't retain forever.
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    retry: 0,
  });
}


