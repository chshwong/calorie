import { POLICY } from "@/constants/constraints";
import { checkProfanity } from "./profanity";

export type PreferredNameValidationResult = {
  ok: boolean;
  errorKey?: string;
};

export function normalizePreferredName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Silent filtering for preferred name input.
 * Mirrors web rules: max length 30, allowed chars, one emoji max, banned emojis.
 */
export function filterPreferredNameInput(currentValue: string, newText: string): string {
  if (newText.length > POLICY.PREFERRED_NAME_MAX_LEN) {
    return currentValue;
  }

  if (newText.length <= currentValue.length) {
    return newText;
  }

  const currentChars = Array.from(currentValue);
  const existingEmojis = new Set<string>();
  for (const ch of currentChars) {
    const codePoint = ch.codePointAt(0);
    if (codePoint && codePoint >= 0x1f000) {
      existingEmojis.add(ch);
    }
  }
  const hasExistingEmoji = existingEmojis.size > 0;

  const newChars = Array.from(newText);
  const banned = new Set(["🤬", "🖕", "💀", "⚰️"]);
  const filteredChars: string[] = [];
  let newEmojiAdded = false;

  for (const ch of newChars) {
    const codePoint = ch.codePointAt(0);
    const isLetter = /\p{L}/u.test(ch);
    const isDigit = /\p{N}/u.test(ch);
    const isSpace = ch === " ";
    const isPunctuation = ch === "'" || ch === "-" || ch === ".";
    const isEmoji = codePoint && codePoint >= 0x1f000;

    if (isLetter || isDigit || isSpace || isPunctuation || isEmoji) {
      if (isEmoji && banned.has(ch)) {
        continue;
      }

      if (isEmoji) {
        if (existingEmojis.has(ch)) {
          filteredChars.push(ch);
          continue;
        }

        if (hasExistingEmoji || newEmojiAdded) {
          continue;
        }

        newEmojiAdded = true;
      }

      filteredChars.push(ch);
    }
  }

  return filteredChars.join("");
}

function validatePreferredNameCore(rawValue: string): { valid: boolean; errorKey?: string } {
  const value = rawValue.trim();
  if (!value) return { valid: false, errorKey: "onboarding.name_age.error_name_required" };

  const chars = Array.from(value);
  let letterCount = 0;
  for (const ch of chars) {
    if (/\p{L}/u.test(ch)) letterCount += 1;
  }

  if (letterCount < POLICY.PREFERRED_NAME_MIN_LETTERS) {
    return { valid: false, errorKey: "onboarding.name_age.error_name_invalid" };
  }

  return { valid: true };
}

export function validatePreferredName(name: string): PreferredNameValidationResult {
  const normalized = normalizePreferredName(name);

  if (!normalized) {
    return { ok: false, errorKey: "onboarding.name_age.error_name_required" };
  }

  if (normalized.length > POLICY.PREFERRED_NAME_MAX_LEN) {
    return { ok: false, errorKey: "onboarding.name_age.error_name_too_long" };
  }

  if (checkProfanity(normalized)) {
    return { ok: false, errorKey: "onboarding.name_age.error_name_invalid" };
  }

  const chars = Array.from(normalized);
  let emojiCount = 0;
  for (const ch of chars) {
    const codePoint = ch.codePointAt(0);
    if (codePoint && codePoint >= 0x1f000) {
      emojiCount += 1;
    }
  }
  if (emojiCount > POLICY.PREFERRED_NAME_MAX_EMOJIS) {
    return { ok: false, errorKey: "onboarding.name_age.error_name_invalid" };
  }

  const nameValidation = validatePreferredNameCore(normalized);
  if (!nameValidation.valid) {
    return { ok: false, errorKey: nameValidation.errorKey || "onboarding.name_age.error_name_invalid" };
  }

  return { ok: true };
}
