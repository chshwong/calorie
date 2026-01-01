import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, StyleSheet, TextInput, TouchableOpacity, View, type TextStyle, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';

type ColorScheme = typeof Colors.light | typeof Colors.dark;

export type InlineEditableNumberChipProps = {
  value: number | null;
  onCommit: (next: number | null) => void;
  unitSuffix?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  allowNull?: boolean;
  disabled?: boolean;
  showEditIcon?: boolean;
  colors: ColorScheme;
  commitOnBlur?: boolean;
  inputWidth?: number;
  style?: ViewStyle;
  badgeTextStyle?: TextStyle;
  inputTextStyle?: TextStyle;
  badgeBackgroundColor?: string;
  badgeBorderColor?: string;
  badgeTextColor?: string;
  accessibilityLabel?: string;
};

export function InlineEditableNumberChip(props: InlineEditableNumberChipProps) {
  const { t } = useTranslation();
  const {
    value,
    onCommit,
    unitSuffix,
    placeholder = '',
    min,
    max,
    allowNull = true,
    disabled = false,
    showEditIcon = false,
    colors,
    commitOnBlur = true,
    inputWidth = 50,
    style,
    badgeTextStyle,
    inputTextStyle,
    badgeBackgroundColor = colors.infoLight,
    badgeBorderColor = colors.info,
    badgeTextColor = colors.info,
    accessibilityLabel,
  } = props;

  const [isEditing, setIsEditing] = useState(false);
  const [input, setInput] = useState(value?.toString() ?? '');
  const [hasError, setHasError] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isEditing) {
      setInput(value?.toString() ?? '');
      setHasError(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isEditing]);

  const clamp = (n: number) => {
    let next = n;
    if (typeof min === 'number') next = Math.max(min, next);
    if (typeof max === 'number') next = Math.min(max, next);
    return next;
  };

  const startEditing = () => {
    if (disabled) return;

    setIsEditing(true);
    setInput(value?.toString() ?? '');
    setHasError(false);

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
        stiffness: 300,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const endEditing = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
        stiffness: 300,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsEditing(false);
    });
  };

  const commit = () => {
    const trimmed = input.trim();
    if (!trimmed) {
      if (!allowNull) {
        setHasError(true);
        return;
      }
      endEditing();
      if (value !== null) onCommit(null);
      return;
    }

    const parsed = parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) {
      setHasError(true);
      return;
    }

    const next = clamp(parsed);
    endEditing();
    if (next !== value) onCommit(next);
  };

  const cancel = () => {
    setInput(value?.toString() ?? '');
    setHasError(false);
    endEditing();
  };

  const handleInputChange = (text: string) => {
    const numericOnly = text.replace(/[^0-9]/g, '');
    if (numericOnly === '') {
      setInput('');
      setHasError(false);
      return;
    }

    const numValue = parseInt(numericOnly, 10);
    if (!Number.isFinite(numValue)) return;

    const next = clamp(numValue);
    setInput(String(next));
    setHasError(false);
  };

  const displayText =
    value !== null
      ? `${value}${unitSuffix ? ` ${unitSuffix}` : ''}`
      : placeholder;

  return (
    <View style={style}>
      {isEditing ? (
        <Animated.View
          style={[
            styles.editorContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[
              styles.editorInput,
              {
                width: inputWidth,
                backgroundColor: colors.card,
                color: colors.text,
                borderColor: hasError ? colors.error : colors.border,
              },
              inputTextStyle,
              Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
            ]}
            value={input}
            onChangeText={handleInputChange}
            onBlur={commitOnBlur ? commit : undefined}
            onSubmitEditing={commit}
            keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
            maxLength={typeof max === 'number' ? String(max).length : undefined}
            selectTextOnFocus
          />
          <TouchableOpacity
            onPress={commit}
            disabled={disabled}
            style={[styles.editorButton, { backgroundColor: colors.tint, marginLeft: Spacing.xs }]}
            {...getButtonAccessibilityProps(
              accessibilityLabel ? `${accessibilityLabel}: ${t('common.save')}` : t('common.save')
            )}
          >
            <IconSymbol name="checkmark" size={14} color={colors.textInverse} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={cancel}
            disabled={disabled}
            style={[styles.editorButton, { backgroundColor: colors.backgroundSecondary, marginLeft: Spacing.xs }]}
            {...getButtonAccessibilityProps(
              accessibilityLabel ? `${accessibilityLabel}: ${t('common.cancel')}` : t('common.cancel')
            )}
          >
            <IconSymbol name="xmark" size={14} color={colors.text} />
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <TouchableOpacity
          onPress={startEditing}
          disabled={disabled}
          style={[
            styles.badge,
            {
              backgroundColor: badgeBackgroundColor,
              borderColor: badgeBorderColor,
              opacity: disabled ? 0.6 : 1,
            },
            Platform.OS === 'web' ? getFocusStyle(colors.tint) : null,
          ]}
          activeOpacity={0.7}
          {...getButtonAccessibilityProps(accessibilityLabel ?? t('common.edit'))}
        >
          <View style={styles.badgeContent}>
            <ThemedText style={[styles.badgeText, { color: badgeTextColor }, badgeTextStyle]}>{displayText}</ThemedText>
            {showEditIcon && !disabled && (
              <View style={styles.editIconWrap}>
                <IconSymbol name="pencil" size={12} color={badgeTextColor} decorative />
              </View>
            )}
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    ...getMinTouchTargetStyle(),
  },
  badgeText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIconWrap: {
    marginLeft: Spacing.xs,
  },
  editorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editorInput: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  editorButton: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...getMinTouchTargetStyle(),
  },
});


