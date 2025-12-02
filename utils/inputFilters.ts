/**
 * Input filtering utilities for user input
 * 
 * Per engineering guidelines: Pure TypeScript functions in shared domain layer
 * No React/browser/UI imports allowed
 */

/**
 * Normalizes spaces in a string by:
 * - Removing leading/trailing spaces
 * - Collapsing multiple consecutive spaces into a single space
 * @param raw - Raw input string
 * @returns Normalized string
 */
export function normalizeSpaces(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * Filters height/weight numeric input to allow only numbers and a single decimal point
 * Prevents multiple decimal points and non-numeric characters
 * @param text - Input text
 * @returns Filtered text with only valid numeric characters
 */
export function filterNumericInput(text: string): string {
  let filtered = text.replace(/[^0-9.]/g, '');
  const parts = filtered.split('.');
  if (parts.length > 2) {
    filtered = parts[0] + '.' + parts.slice(1).join('');
  }
  return filtered;
}

/**
 * Silent filtering function for preferred name input
 * Preserves existing valid emojis, only filters new characters being added
 * 
 * Rules:
 * - Max length: 30 characters
 * - Allows letters, numbers, spaces, apostrophes, hyphens, periods
 * - Allows at most one emoji (preserves existing if present)
 * - Blocks banned emojis
 * 
 * @param currentValue - Current value of the input
 * @param newText - New text being entered
 * @returns Filtered text
 */
export function filterPreferredNameInput(currentValue: string, newText: string): string {
  // Enforce maxLength 30
  if (newText.length > 30) {
    return currentValue;
  }
  
  // If new text is shorter or equal, it's deletion/editing - allow it (will be validated later)
  if (newText.length <= currentValue.length) {
    return newText;
  }
  
  // Extract existing emojis from current value to preserve them
  const currentChars = Array.from(currentValue);
  const existingEmojis = new Set<string>();
  for (const ch of currentChars) {
    const codePoint = ch.codePointAt(0);
    if (codePoint && codePoint >= 0x1F000) {
      existingEmojis.add(ch);
    }
  }
  const hasExistingEmoji = existingEmojis.size > 0;
  
  // Process new text character by character, preserving existing valid content
  const newChars = Array.from(newText);
  const BANNED = new Set(['🤬', '🖕', '💀', '⚰️']);
  const filteredChars: string[] = [];
  let newEmojiAdded = false;
  
  for (const ch of newChars) {
    const codePoint = ch.codePointAt(0);
    const isLetter = /\p{L}/u.test(ch);
    const isDigit = /\p{N}/u.test(ch);
    const isSpace = ch === ' ';
    const isPunctuation = ch === "'" || ch === '-' || ch === '.';
    const isEmoji = codePoint && codePoint >= 0x1F000;
    
    // Check if character is valid
    if (isLetter || isDigit || isSpace || isPunctuation || isEmoji) {
      // Check for banned emojis
      if (isEmoji && BANNED.has(ch)) {
        continue; // Skip banned emoji
      }
      
      // Handle emoji logic
      if (isEmoji) {
        // If this emoji already exists in current value, always preserve it
        if (existingEmojis.has(ch)) {
          filteredChars.push(ch);
          continue;
        }
        
        // If we already have an emoji (existing or newly added), skip this new one
        if (hasExistingEmoji || newEmojiAdded) {
          continue; // Skip second emoji
        }
        
        // This is a new allowed emoji - add it
        newEmojiAdded = true;
      }
      
      filteredChars.push(ch);
    }
    // Invalid characters are silently ignored
  }
  
  return filteredChars.join('');
}

