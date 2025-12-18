import React from 'react';
import { View, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { onboardingStyles } from '@/theme/onboardingStyles';

interface OnboardingErrorBoxProps {
  errorKey?: string | null;
  errorParams?: Record<string, any>;
  errorText?: string | null;
}

export const OnboardingErrorBox: React.FC<OnboardingErrorBoxProps> = ({
  errorKey,
  errorParams,
  errorText,
}) => {
  const { t } = useTranslation();
  
  if (!errorKey && !errorText) {
    return null;
  }
  
  const displayText = errorKey
    ? (() => {
        const translated = t(errorKey, errorParams);
        // Safe fallback: if translation returns the same string as the key, show generic error
        if (translated === errorKey) {
          return t('common.unexpected_error');
        }
        return translated;
      })()
    : errorText;
  
  return (
    <View
      style={[onboardingStyles.errorContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#EF4444' }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      {...(Platform.OS === 'web' ? { role: 'alert', 'aria-live': 'polite' as const } : {})}
    >
      <ThemedText style={[onboardingStyles.errorText, { color: '#EF4444' }]}>
        {displayText}
      </ThemedText>
    </View>
  );
};

