import { View, Platform, Dimensions } from 'react-native';
import { onboardingColors } from '@/theme/onboardingTheme';
import { onboardingStyles } from '@/theme/onboardingStyles';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  colors: {
    border: string;
  };
}

export function StepIndicator({ currentStep, totalSteps, colors }: StepIndicatorProps) {
  const screenWidth = Dimensions.get('window').width;
  
  // Mobile-responsive logic: scale down on narrow screens
  const isMobile = screenWidth < 600;
  const isVeryNarrow = screenWidth < 480;
  const scaleFactor = isVeryNarrow ? 0.65 : isMobile ? 0.75 : 1;
  
  // Calculate responsive sizing based on screen width
  const isNarrow = screenWidth < 375;
  const dotSize = isVeryNarrow ? 8 : isNarrow ? 10 : 12;
  const lineWidth = isVeryNarrow ? 20 : isNarrow ? 28 : 40;
  const lineMargin = isVeryNarrow ? 2 : isNarrow ? 3 : 4;
  const containerPadding = isVeryNarrow ? 8 : isNarrow ? 16 : 40;
  
  return (
    <View style={onboardingStyles.stepIndicatorWrapper}>
      <View
        style={[
          onboardingStyles.stepIndicatorContainer,
          {
            paddingHorizontal: containerPadding,
            transform: [{ scale: scaleFactor }],
            transformOrigin: 'center',
          },
          Platform.select({
            web: {
              transformOrigin: 'center',
            },
            default: {},
          }),
        ]}
      >
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNumber = i + 1; // Convert 0-based index to 1-based step number
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;
        
        return (
          <View key={i} style={onboardingStyles.stepIndicatorRow}>
            <View
              style={[
                onboardingStyles.stepDot,
                {
                    width: dotSize,
                    height: dotSize,
                    borderRadius: dotSize / 2,
                    backgroundColor: isCompleted ? onboardingColors.primary : colors.border,
                    borderColor: isActive ? onboardingColors.primary : colors.border,
                },
              ]}
            />
            {i < totalSteps - 1 && (
              <View
                style={[
                  onboardingStyles.stepLine,
                  {
                      width: lineWidth,
                      height: isVeryNarrow ? 1.5 : 2,
                      marginHorizontal: lineMargin,
                      backgroundColor: isCompleted ? onboardingColors.primary : colors.border,
                  },
                ]}
              />
            )}
          </View>
        );
      })}
      </View>
    </View>
  );
}

