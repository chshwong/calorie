import React from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { onboardingStyles } from '@/theme/onboardingStyles';
import { onboardingColors } from '@/theme/onboardingTheme';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

interface OnboardingPrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}

export const OnboardingPrimaryButton: React.FC<OnboardingPrimaryButtonProps> = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  testID,
}) => {
  const { t } = useTranslation();
  
  return (
    <TouchableOpacity
      style={[
        onboardingStyles.buttonModern,
        getMinTouchTargetStyle(),
        {
          opacity: (loading || disabled) ? 0.6 : 1,
          ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
          ...Platform.select({
            web: {
              background: `linear-gradient(180deg, ${onboardingColors.primary}, ${onboardingColors.primaryDark})`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 12px rgba(22, 161, 184, 0.3)',
            },
            default: {
              backgroundColor: onboardingColors.primary,
              shadowColor: onboardingColors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 4,
            },
          }),
        },
      ]}
      onPress={onPress}
      disabled={loading || disabled}
      testID={testID}
      {...getButtonAccessibilityProps(
        label,
        'Double tap to continue',
        loading || disabled
      )}
    >
      {loading ? (
        <View style={onboardingStyles.buttonLoading}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={onboardingStyles.buttonText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <Text style={onboardingStyles.buttonText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};

