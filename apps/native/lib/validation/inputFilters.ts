/**
 * Input filtering utilities for numeric input.
 */

export function filterNumericInput(text: string): string {
  let filtered = text.replace(/[^0-9.]/g, "");
  const parts = filtered.split(".");
  if (parts.length > 2) {
    filtered = parts[0] + "." + parts.slice(1).join("");
  }
  return filtered;
}
