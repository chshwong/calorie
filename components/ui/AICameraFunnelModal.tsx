import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Image,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

import AICustomButtonImg from '@/assets/images/AI_CUSTOM_BUTTON.png';
import AIQuickLogButtonImg from '@/assets/images/AI_QUICKLOG_BUTTON.png';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, FontSize, FontWeight, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';

type AICameraFunnelModalProps = {
  visible: boolean;
  onClose: () => void;
  date: string;
  mealType: string;
};

export function AICameraFunnelModal({
  visible,
  onClose,
  date,
  mealType,
}: AICameraFunnelModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme ?? 'light'];
  const [isRouting, setIsRouting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setIsRouting(false);
    }
  }, [visible]);

  const handleClose = () => {
    if (isRouting) return;
    onClose();
  };

  const handleQuickLog = () => {
    if (isRouting) return;
    setIsRouting(true);
    onClose();
    router.push({
      pathname: '/quick-log',
      params: { date, mealType, tab: 'ai' },
    });
  };

  const handleCreateCustomFood = () => {
    if (isRouting) return;
    setIsRouting(true);
    onClose();
    router.push({
      pathname: '/create-custom-food',
      params: { mealType, entryDate: date, tab: 'ai' },
    });
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={handleClose}
          disabled={isRouting}
          {...getButtonAccessibilityProps(
            t('home.ai_camera_funnel.close', { defaultValue: 'Close' }),
            t('home.ai_camera_funnel.close', { defaultValue: 'Close' }),
            isRouting
          )}
        />
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <ThemedText style={[styles.title, { color: colors.text }]}>
                {t('home.ai_camera_funnel.title', { defaultValue: 'AI Camera' })}
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('home.ai_camera_funnel.subtitle', { defaultValue: 'Choose how you want to log' })}
              </ThemedText>
            </View>
            <TouchableOpacity
              style={[
                styles.closeButton,
                { backgroundColor: colors.icon + '12' },
                getMinTouchTargetStyle(),
                ...(Platform.OS === 'web' ? [getFocusStyle(colors.tint)] : []),
              ]}
              onPress={handleClose}
              disabled={isRouting}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(
                t('home.ai_camera_funnel.close', { defaultValue: 'Close' }),
                t('home.ai_camera_funnel.close', { defaultValue: 'Close' }),
                isRouting
              )}
            >
              <IconSymbol name="xmark" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.optionCard,
                {
                  backgroundColor: colors.tint,
                  borderColor: colors.tint,
                  opacity: isRouting ? 0.6 : 1,
                },
                getMinTouchTargetStyle(),
                ...(Platform.OS === 'web' ? [getFocusStyle('#fff')] : []),
              ]}
              onPress={handleQuickLog}
              disabled={isRouting}
              {...getButtonAccessibilityProps(
                t('home.ai_camera_funnel.quicklog_title', { defaultValue: 'Quick Log a Meal' }),
                t('home.ai_camera_funnel.quicklog_helper', { defaultValue: 'Log 1-time meal now' }),
                isRouting
              )}
            >
              <View style={styles.optionRow}>
                <View style={styles.optionTextCol}>
                  <ThemedText style={[styles.optionTitle, { color: colors.textOnTint }]}>
                    {t('home.ai_camera_funnel.quicklog_title', { defaultValue: 'Quick Log a Meal' })}
                  </ThemedText>
                  <ThemedText style={[styles.optionHelper, { color: colors.textOnTint + 'CC' }]}>
                    {t('home.ai_camera_funnel.quicklog_helper', { defaultValue: 'Log 1-time meal now' })}
                  </ThemedText>
                </View>
                <View style={styles.optionRight}>
                  <Image
                    source={AIQuickLogButtonImg}
                    style={[
                      styles.optionThumb,
                      { borderColor: 'rgba(255,255,255,0.25)' },
                    ]}
                  />
                </View>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.optionCard,
                {
                  borderColor: colors.icon + '30',
                  backgroundColor: colors.background,
                  opacity: isRouting ? 0.6 : 1,
                },
                getMinTouchTargetStyle(),
                ...(Platform.OS === 'web' ? [getFocusStyle(colors.tint)] : []),
              ]}
              onPress={handleCreateCustomFood}
              disabled={isRouting}
              {...getButtonAccessibilityProps(
                t('home.ai_camera_funnel.customfood_title', { defaultValue: 'Create Custom Food' }),
                t('home.ai_camera_funnel.customfood_helper', { defaultValue: 'For foods you’ll log again' }),
                isRouting
              )}
            >
              <View style={styles.optionRow}>
                <View style={styles.optionTextCol}>
                  <ThemedText style={[styles.optionTitle, { color: colors.text }]}>
                    {t('home.ai_camera_funnel.customfood_title', { defaultValue: 'Create Custom Food' })}
                  </ThemedText>
                  <ThemedText style={[styles.optionHelper, { color: colors.textSecondary }]}>
                    {t('home.ai_camera_funnel.customfood_helper', { defaultValue: 'For foods you’ll log again' })}
                  </ThemedText>
                </View>
                <View style={styles.optionRight}>
                  <Image
                    source={AICustomButtonImg}
                    style={[
                      styles.optionThumb,
                      { borderColor: colors.icon + '20' },
                    ]}
                  />
                </View>
              </View>
            </Pressable>

            <TouchableOpacity
              style={[
                styles.closeTextButton,
                getMinTouchTargetStyle(),
                ...(Platform.OS === 'web' ? [getFocusStyle(colors.tint)] : []),
              ]}
              onPress={handleClose}
              disabled={isRouting}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(
                t('home.ai_camera_funnel.close', { defaultValue: 'Close' }),
                t('home.ai_camera_funnel.close', { defaultValue: 'Close' }),
                isRouting
              )}
            >
              <ThemedText style={[styles.closeText, { color: colors.textSecondary }]}>
                {t('home.ai_camera_funnel.close', { defaultValue: 'Close' })}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.md,
    ...Shadows.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  subtitle: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.3,
  },
  closeButton: {
    width: Spacing['4xl'],
    height: Spacing['4xl'],
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  optionCard: {
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    ...Shadows.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTextCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 0,
  },
  optionThumb: {
    width: 101*1.2,
    height: 74*1.2,
    borderRadius: BorderRadius.lg,
    resizeMode: 'cover',
    borderWidth: 1,
  },
  optionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  optionHelper: {
    marginTop: Spacing.xxs,
    fontSize: FontSize.base,
  },
  closeTextButton: {
    alignSelf: 'center',
    marginTop: Spacing.sm,
  },
  closeText: {
    fontSize: FontSize.gaugeLabelMd,
  },
});
