/**
 * Profanity filtering utilities (native copy).
 * Pure TS; no UI imports.
 */

// Category A: Long, unambiguous profanities that should be blocked if found as substrings
export const SUBSTRING_BANNED = [
  "fuck",
  "fucker",
  "motherfucker",
  "shit",
  "bullshit",
  "bitch",
  "asshole",
  "bastard",
  "dickhead",
  "pussy",
  "slut",
  "whore",
  "cunt",
  "faggot",
  "retarded",
  "rapist",
  "suckmy",
  "myass",
  "mytits",
  "mycock",
  "myass",
  "mytits",
  "mydick",
  "dickhead",
  "penis",
  "vagina",
] as const;

// Category B: Short, ambiguous words that only count as profanity when the entire cleaned name equals them
export const EXACT_BANNED = [
  "mf",
  "dick",
  "fag",
  "spic",
  "chink",
  "kike",
  "negro",
  "nigger",
  "nigga",
  "rape",
] as const;

/**
 * Cleans string for profanity checking
 * - Converts to lowercase
 * - Removes punctuation: apostrophes (' and '), hyphens (-), and periods (.)
 * - Trims whitespace
 */
export function cleanForProfanityCheck(raw: string): string {
  return raw.toLowerCase().replace(/[''.-]/g, "").trim();
}

/**
 * Main reusable profanity checker
 */
export function checkProfanity(raw: string): boolean {
  const clean = cleanForProfanityCheck(raw);

  if (!clean) return false;

  // Category B – exact-match only (short ambiguous words)
  if (EXACT_BANNED.includes(clean)) return true;

  // Category A – substring match (long unambiguous profanities)
  for (const bad of SUBSTRING_BANNED) {
    if (clean.includes(bad)) return true;
  }

  return false;
}
