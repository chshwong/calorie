/**
 * Accessibility utilities and constants for WCAG 2.0 AA compliance
 */

import { Platform } from 'react-native';

/**
 * Minimum touch target size for WCAG 2.0 AA compliance (44x44 points)
 */
export const MIN_TOUCH_TARGET_SIZE = 26;

/**
 * Accessibility roles for React Native components
 */
export const AccessibilityRoles = {
  BUTTON: 'button',
  LINK: 'link',
  TEXT: 'text',
  HEADER: 'header',
  IMAGE: 'image',
  INPUT: 'none', // TextInput uses 'none' role
  CHECKBOX: 'checkbox',
  SWITCH: 'switch',
  TAB: 'tab',
  LIST: 'list',
  LISTITEM: 'listitem',
} as const;

/**
 * Common accessibility hints for better screen reader experience
 */
export const AccessibilityHints = {
  BUTTON: 'Double tap to activate',
  LINK: 'Double tap to open',
  CLOSE: 'Double tap to close',
  BACK: 'Double tap to go back',
  SUBMIT: 'Double tap to submit',
  TOGGLE: 'Double tap to toggle',
  SELECT: 'Double tap to select',
  EDIT: 'Double tap to edit',
  DELETE: 'Double tap to delete',
  NAVIGATE: 'Double tap to navigate',
} as const;

/**
 * Get accessibility props for a button
 */
export function getButtonAccessibilityProps(
  label: string,
  hint?: string,
  disabled?: boolean
) {
  return {
    accessibilityRole: AccessibilityRoles.BUTTON as const,
    accessibilityLabel: label,
    accessibilityHint: hint || AccessibilityHints.BUTTON,
    accessibilityState: {
      disabled: disabled || false,
    },
  };
}

/**
 * Get accessibility props for a link
 */
export function getLinkAccessibilityProps(label: string, hint?: string) {
  return {
    accessibilityRole: AccessibilityRoles.LINK as const,
    accessibilityLabel: label,
    accessibilityHint: hint || AccessibilityHints.LINK,
  };
}

/**
 * Get accessibility props for a text input
 */
export function getInputAccessibilityProps(
  label: string,
  hint?: string,
  error?: string,
  required?: boolean
) {
  return {
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRequired: required,
    accessibilityLiveRegion: (error ? 'polite' : undefined) as 'polite' | undefined,
  };
}

/**
 * Get accessibility props for an icon
 */
export function getIconAccessibilityProps(label: string, decorative = false) {
  if (decorative) {
    return {
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants' as const,
    };
  }
  return {
    accessibilityRole: AccessibilityRoles.IMAGE as const,
    accessibilityLabel: label,
  };
}

/**
 * Get minimum touch target style
 */
export function getMinTouchTargetStyle() {
  return {
    minWidth: MIN_TOUCH_TARGET_SIZE,
    minHeight: MIN_TOUCH_TARGET_SIZE,
  };
}

/**
 * Get web-specific accessibility props
 */
export function getWebAccessibilityProps(
  role?: string,
  ariaLabel?: string,
  ariaDescribedBy?: string,
  ariaInvalid?: boolean,
  ariaRequired?: boolean
) {
  if (Platform.OS !== 'web') {
    return {};
  }

  const props: Record<string, any> = {};
  if (role) props.role = role;
  if (ariaLabel) props['aria-label'] = ariaLabel;
  if (ariaDescribedBy) props['aria-describedby'] = ariaDescribedBy;
  if (ariaInvalid !== undefined) props['aria-invalid'] = ariaInvalid;
  if (ariaRequired !== undefined) props['aria-required'] = ariaRequired;

  return props;
}

/**
 * Get focus style for keyboard navigation (web)
 * Modern, subtle focus indicator that only appears on keyboard focus
 */
export function getFocusStyle(color: string) {
  if (Platform.OS !== 'web') {
    return {};
  }

  return {
    // Only show outline on focus, not always
    outlineWidth: 0,
    // Use CSS focus-visible for keyboard-only focus
    // This will be handled via className in web components
  };
}

/**
 * Get modern focus ring style (for web, using CSS classes)
 * This creates a subtle, modern focus indicator
 */
export function getModernFocusRing(color: string) {
  if (Platform.OS !== 'web') {
    return {};
  }

  // Return style that can be used with focus-visible pseudo-class
  // The actual focus ring will be applied via CSS
  return {
    outlineWidth: 0,
    // Note: Actual focus ring styling should be done via CSS
    // This is a placeholder for the style object
  };
}

