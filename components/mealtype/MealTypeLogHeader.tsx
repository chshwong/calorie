import React, { RefObject } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
} from '@/utils/accessibility';
import type { Colors } from '@/constants/theme';

type MealTypeLogHeaderProps = {
  mealTypeLabel: string;
  formattedDate: string;
  onBack: () => void;
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
      {/* First Line: Back Arrow, Diary Title, Empty Right */}
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={[
            styles.backArrowButton,
            getMinTouchTargetStyle(),
          ]}
          onPress={onBack}
          activeOpacity={0.7}
          {...getButtonAccessibilityProps(
            'Go back',
            'Double tap to go back'
          )}
        >
          <ThemedText style={[styles.backArrow, { color: colors.tint }]}>←</ThemedText>
        </TouchableOpacity>
        <View style={styles.titleCenter}>
          <ThemedText style={[styles.mainTitle, { color: colors.text }]}>🍴 {t('mealtype_log.title')}</ThemedText>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.placeholder} />
        </View>
      </View>
      
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

