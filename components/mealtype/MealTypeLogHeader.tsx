import React, { RefObject } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { getButtonAccessibilityProps, getMinTouchTargetStyle } from '@/utils/accessibility';
import type { Colors } from '@/constants/theme';
import { StandardSubheader } from '@/components/navigation/StandardSubheader';

type MealTypeLogHeaderProps = {
  mealTypeLabel: string;
  formattedDate: string;
  onBack?: () => void;
  onMealTypePress: () => void;
  onDatePress: () => void;
  mealTypeButtonRef: RefObject<View | null>;
  onMealTypeLayout: (layout: { x: number; y: number; width: number; height: number }) => void;
  colors: typeof Colors.light | typeof Colors.dark;
  t: (key: string) => string;
  styles: any;
};

export function MealTypeLogHeader({
  mealTypeLabel,
  formattedDate,
  onBack,
  onMealTypePress,
  onDatePress,
  mealTypeButtonRef,
  onMealTypeLayout,
  colors,
  t,
  styles,
}: MealTypeLogHeaderProps) {
  return (
    <View style={styles.headerContainer}>
      {/* First Line: Back, Title, Optional Right */}
      <StandardSubheader title={`🍴 ${t('mealtype_log.title')}`} onBack={onBack} />
      
      {/* Second Line: Meal Type and Date - Centered */}
      <View style={styles.headerBottom}>
        <View
          ref={mealTypeButtonRef}
          onLayout={() => {
            mealTypeButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
              onMealTypeLayout({ x: pageX, y: pageY + height, width, height });
            });
          }}
        >
          <TouchableOpacity
            style={[
              getMinTouchTargetStyle(),
            ]}
            onPress={onMealTypePress}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps(
              `Change meal type, currently ${mealTypeLabel}`,
              'Double tap to change meal type'
            )}
          >
            <ThemedText style={[styles.subHeaderMealType, { color: colors.tint }]}>{mealTypeLabel} ▼</ThemedText>
          </TouchableOpacity>
        </View>
        <ThemedText style={[styles.subHeaderSeparator, { color: colors.textSecondary }]}> • </ThemedText>
        <TouchableOpacity
          style={[
            getMinTouchTargetStyle(),
          ]}
          onPress={onDatePress}
          activeOpacity={0.7}
          {...getButtonAccessibilityProps(
            `Change date, currently ${formattedDate}`,
            'Double tap to change the date'
          )}
        >
          <ThemedText style={[styles.subHeaderDate, { color: colors.tint }]}>{formattedDate}</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

