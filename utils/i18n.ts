export function pickI18n(i18nJson: Record<string, string> | null | undefined, locale: string): string {
  if (!i18nJson) return '';

  const direct = locale ? i18nJson[locale] : undefined;
  if (direct) return direct;

  if (i18nJson.en) return i18nJson.en;

  const fallback = Object.values(i18nJson).find((value) => value && value.trim().length > 0);
  return fallback ?? '';
}
