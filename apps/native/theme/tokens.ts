export const colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F7F8FA',
    card: '#FFFFFF',
    text: '#0F172A',
    textMuted: '#6B7280',
    border: '#E5E7EB',
    primary: '#16A1B8',
    primaryText: '#FFFFFF',
    secondary: '#0F172A',
    secondaryText: '#FFFFFF',
    ghost: '#0F172A',
    brandAvo: '#526C19',
    brandVibe: '#B8553F',
    inputBackground: '#FFFFFF',
    inputBorder: '#D1D5DB',
    placeholder: '#9CA3AF',
    danger: '#DC2626',
    dangerText: '#FFFFFF',
  },
  dark: {
    background: '#0B0F14',
    surface: '#111827',
    card: '#0F172A',
    text: '#F9FAFB',
    textMuted: '#9CA3AF',
    border: '#1F2937',
    primary: '#16A1B8',
    primaryText: '#FFFFFF',
    secondary: '#1F2937',
    secondaryText: '#F9FAFB',
    ghost: '#F9FAFB',
    brandAvo: '#DCF048',
    brandVibe: '#E9876F',
    inputBackground: '#0F172A',
    inputBorder: '#374151',
    placeholder: '#6B7280',
    danger: '#F87171',
    dangerText: '#0B0F14',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fontSizes = {
  title: 22,
  body: 16,
  label: 14,
  caption: 12,
} as const;
