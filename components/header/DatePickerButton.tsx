import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppDatePicker } from '@/components/ui/app-date-picker';
import { Colors, BorderRadius, ModuleThemes, type ModuleType } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

type DatePickerButtonProps = {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  today: Date;
  module?: ModuleType;
  minimumDate?: Date;
  maximumDate?: Date;
};

/**
 * Simple calendar button that opens a date picker modal
 * Extracted from DateHeader for reuse in CollapsibleModuleHeader
 */
export function DatePickerButton({
  selectedDate,
  onDateSelect,
  today,
  module,
  minimumDate,
  maximumDate,
}: DatePickerButtonProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const moduleAccent = module && ModuleThemes[module] ? ModuleThemes[module].accent : colors.tint;
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const max = useMemo(() => maximumDate ?? today, [maximumDate, today]);

  return (
    <>
      <TouchableOpacity
        style={[
          styles.calendarButton,
          getMinTouchTargetStyle(),
          {
            backgroundColor: moduleAccent,
            ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
          },
          Platform.OS === 'web' && {
            zIndex: 10,
            pointerEvents: 'auto' as any, // Type assertion needed for React Native web pointerEvents type compatibility
          },
        ]}
        onPress={() => {
          setShowDatePicker(true);
        }}
        activeOpacity={0.8}
        pointerEvents="auto"
        {...getButtonAccessibilityProps(
          t('home.date_picker.select_date'),
          'Double tap to open date picker'
        )}
      >
        <IconSymbol name="calendar" size={18} color="#fff" decorative={true} />
      </TouchableOpacity>

      <AppDatePicker
        value={selectedDate}
        onChange={(date) => {
          onDateSelect(date);
          setShowDatePicker(false);
        }}
        minimumDate={minimumDate}
        maximumDate={max}
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        title={t('home.date_picker.title')}
        accentColor={moduleAccent}
      />
    </>
  );
}

const styles = StyleSheet.create({
  calendarButton: {
    width: 32, // Touch target size for calendar icon button
    height: 32,
    borderRadius: BorderRadius.xl, // 16px - matches standard modal/content radius
    alignItems: 'center',
    justifyContent: 'center',
  },
  // NOTE: Date picker modal/calendar styles are centralized in `AppDatePicker`.
});

