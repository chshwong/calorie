/**
 * Single source of truth for SEO constants (AvoVibe marketing/Next layer).
 */

export const siteName = "AvoVibe";
export const domain = "https://avovibe.app";

export const titleDefault = "AvoVibe – Free Calorie & Macro Tracker";
export const descriptionDefault =
  "Track calories, macros, protein, fiber, and water with no paywalls.";

export const twitterHandle = ""; // optional; empty ok
export const ogImage = `${domain}/og.png`;

export const keywords = [
  "calorie tracker",
  "macro tracker",
  "free calorie counter",
  "protein tracker",
  "food diary",
  "AvoVibe",
];

/** Optional brand colors for OG/UI (hex). */
export const brandColors = {
  primary: "#B8553F",
  secondary: "#526C19",
} as const;
