import * as Localization from "expo-localization";

export function getDeviceRegion(): string | null {
  const locales = Localization.getLocales?.();
  const locale = locales?.[0];
  const region = locale?.regionCode ?? (locale as any)?.countryCode ?? null;
  return typeof region === "string" && region.length > 0 ? region.toUpperCase() : null;
}
