import React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Colors, FontSize, SemanticColors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';

type Action = {
  label: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
};

type Props = {
  statusLine: string;
  connected: boolean;
  logo: React.ReactNode;
  primaryAction?: Action | null;
  secondaryAction?: Action | null;
  children?: React.ReactNode;
  style?: ViewStyle;
};

/**
 * Reusable Fitbit connection/status/action card.
 *
 * UI-only. Callers provide connection state and action handlers (hooks stay in screens/hooks).
 */
export function FitbitConnectionCard({
  statusLine,
  connected,
  logo,
  primaryAction,
  secondaryAction,
  children,
  style,
}: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const logoChipBg = scheme === 'dark' ? Colors.light.card : colors.backgroundSecondary;

  const renderButton = (action: Action, variant: 'primary' | 'secondary') => {
    const isPrimary = variant === 'primary';
    const disabled = Boolean(action.disabled);
    return (
      <TouchableOpacity
        onPress={action.onPress}
        disabled={disabled}
        activeOpacity={0.85}
        style={[
          isPrimary ? styles.primaryBtn : styles.secondaryBtn,
          isPrimary
            ? { backgroundColor: colors.tint, opacity: disabled ? 0.6 : 1 }
            : { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, opacity: disabled ? 0.6 : 1 },
          getMinTouchTargetStyle(),
          Platform.OS === 'web' && getFocusStyle(isPrimary ? '#fff' : colors.tint),
        ]}
        {...getButtonAccessibilityProps(action.accessibilityLabel ?? action.label)}
      >
        {action.loading ? (
          <ActivityIndicator size="small" color={isPrimary ? colors.textInverse : colors.tint} />
        ) : (
          <ThemedText style={[isPrimary ? styles.primaryBtnText : styles.secondaryBtnText, { color: isPrimary ? colors.textInverse : colors.text }]}>
            {action.label}
          </ThemedText>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }, style]}>
      <View style={styles.row}>
        <View style={styles.logoWrap} accessible accessibilityLabel="Fitbit">
          <View style={[styles.logoChip, { backgroundColor: logoChipBg }]} accessible={false}>
            <View style={styles.logoBox} accessible={false}>
              {logo}
            </View>
          </View>
        </View>

        <View style={styles.main}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: connected ? SemanticColors.success : colors.textMuted },
              ]}
              accessible={false}
            />
            <ThemedText style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={2}>
              {statusLine}
            </ThemedText>
          </View>

          {(primaryAction || secondaryAction) ? (
            <View style={styles.actionRow}>
              {connected && primaryAction && secondaryAction ? (
                <View style={styles.btnRow}>
                  {renderButton(primaryAction, 'primary')}
                  {renderButton(secondaryAction, 'secondary')}
                </View>
              ) : primaryAction ? (
                renderButton(primaryAction, 'primary')
              ) : null}
            </View>
          ) : null}

          {children ? <View style={styles.childrenWrap}>{children}</View> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  logoWrap: {
    flexShrink: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  logoChip: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    height: 34,
    aspectRatio: 3.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    alignItems: 'flex-start',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    flexShrink: 1,
  },
  actionRow: {
    marginTop: Spacing.sm,
  },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  primaryBtn: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  primaryBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  secondaryBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  secondaryBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  childrenWrap: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
    alignSelf: 'stretch',
  },
});

