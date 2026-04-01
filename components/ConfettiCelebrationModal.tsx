import { ThemedText } from '@/components/themed-text';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { avoConfetti } from '@/lib/avoConfetti';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

// Conditional import for confetti (native only)
let ConfettiCannon: any = null;
if (Platform.OS !== 'web') {
  try {
    ConfettiCannon = require('react-native-confetti-cannon').default;
  } catch (e) {
    // Package not installed yet, will be handled gracefully
  }
}

export type ConfettiCelebrationModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  withConfetti?: boolean;
  aiInsight?: string | null;
  onConfirm: () => void;
};

export function ConfettiCelebrationModal({
  visible,
  title,
  message,
  confirmText = 'Got it',
  withConfetti = true,
  aiInsight = null,
  onConfirm,
}: ConfettiCelebrationModalProps) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const confettiRef = useRef<any>(null);

  useEffect(() => {
    if (__DEV__ && visible) {
      console.log('[AvoInsight] ConfettiCelebrationModal props', {
        hasAiInsight: !!aiInsight,
        aiInsightPreview: aiInsight
          ? aiInsight.length > 48
            ? `${aiInsight.slice(0, 48)}…`
            : aiInsight
          : null,
      });
    }
  }, [visible, aiInsight]);

  // Trigger confetti when modal opens
  useEffect(() => {
    if (visible && withConfetti) {
      if (Platform.OS !== 'web' && ConfettiCannon && confettiRef.current) {
        // Native confetti
        // Small delay to sync with modal animation
        setTimeout(() => {
          confettiRef.current?.start();
        }, 100);
      } else if (Platform.OS === 'web') {
        // Web confetti: dynamic import to ensure compatibility
        (async () => {
          try {
            const confettiModule = await import('canvas-confetti');
            const confettiFn = confettiModule.default || confettiModule;
            if (typeof confettiFn === 'function') {
              // Web confetti: 2-3 small bursts over ~600ms (unchanged visuals)
              avoConfetti(() => {
                confettiFn({ particleCount: 80, spread: 60, origin: { y: 0.35 } });
                setTimeout(() => {
                  confettiFn({ particleCount: 50, spread: 80, origin: { y: 0.35 } });
                }, 200);
                setTimeout(() => {
                  confettiFn({ particleCount: 40, spread: 100, origin: { y: 0.35 } });
                }, 450);
              });
            }
          } catch (e) {
            // canvas-confetti not available, skip confetti
            console.warn('Failed to load canvas-confetti:', e);
          }
        })();
      }
    }
  }, [visible, withConfetti]);

  return (
    <>
      {/* Confirmation Modal */}
      <ConfirmModal
        visible={visible}
        title={title}
        message={
          <View>
            <ThemedText style={[styles.messageText, { color: colors.text }]}>{message}</ThemedText>
            {aiInsight ? (
              <View
                style={[
                  styles.insightCard,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.border,
                  },
                ]}
              >
                <ThemedText style={[styles.insightTitle, { color: colors.textSecondary }]}>
                  {t('home.done_for_today.ai_insight_title', { defaultValue: 'Avo Insight' })}
                </ThemedText>
                <ThemedText style={[styles.insightBody, { color: colors.text }]}>{aiInsight}</ThemedText>
              </View>
            ) : null}
          </View>
        }
        confirmText={confirmText}
        cancelText={null}
        onConfirm={onConfirm}
        onCancel={onConfirm}
        animationType="fade"
      />

      {/* Confetti (native only) - rendered above modal in transparent Modal wrapper */}
      {withConfetti && Platform.OS !== 'web' && ConfettiCannon && visible && (
        <Modal visible={true} transparent animationType="none" onRequestClose={() => {}}>
          <View style={styles.confettiContainer} pointerEvents="none">
            <ConfettiCannon
              ref={confettiRef}
              count={200}
              origin={{ x: screenWidth / 2, y: 0 }}
              fadeOut={true}
              autoStart={false}
            />
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  messageText: {
    textAlign: 'center',
  },
  insightCard: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  insightTitle: {
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  insightBody: {},
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
    pointerEvents: 'none',
  },
});

