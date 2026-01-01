/**
 * Centralized external links.
 *
 * Per engineering guidelines:
 * - Avoid hardcoding URLs in multiple places.
 */

export const DONATION_URL = process.env.EXPO_PUBLIC_DONATION_URL ?? 'https://buymeacoffee.com/avovibe';

// Public support contact (used for compliance pages like /data-deletion).
// Can be overridden at build-time via EXPO_PUBLIC_SUPPORT_EMAIL.
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'avovibeapp@gmail.com';
export const SUPPORT_EMAIL_MAILTO = `mailto:${SUPPORT_EMAIL}`;


