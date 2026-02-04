/**
 * Canonical date key helpers (YYYY-MM-DD, local timezone).
 */

export function toDateKey(input?: Date | string | number | null): string {
  if (!input) {
    return formatDateKey(new Date());
  }

  if (typeof input === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return input;
    }
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
      return formatDateKey(new Date());
    }
    return formatDateKey(parsed);
  }

  if (typeof input === "number") {
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
      return formatDateKey(new Date());
    }
    return formatDateKey(parsed);
  }

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      return formatDateKey(new Date());
    }
    return formatDateKey(input);
  }

  return formatDateKey(new Date());
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dateKey: string, deltaDays: number): string {
  const base = new Date(`${dateKey}T00:00:00`);
  base.setDate(base.getDate() + deltaDays);
  return formatDateKey(base);
}

export function getTodayKey(): string {
  return formatDateKey(new Date());
}
