/**
 * AvoScore Info Modal - Explains grades and what AvoScore is.
 * Reusable; opened when user taps the AvoScore letter in the donut (Mealtype Log + Food Edit).
 * Grade colors match the donut (shared getAvoScoreGradeColor).
 */

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getButtonAccessibilityProps, getFocusStyle, getMinTouchTargetStyle } from '@/utils/accessibility';
import type { AvoScoreGrade } from '@/utils/avoScore';
import { getAvoScoreGradeColor } from '@/utils/avoScoreColors';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';

const GRADES: AvoScoreGrade[] = ['A', 'B', 'C', 'D', 'F'];

export interface AvoScoreInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AvoScoreInfoModal({ isOpen, onClose }: AvoScoreInfoModalProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <TouchableWithoutFeedback>
          <View style={[styles.content, { backgroundColor: colors.card }]}>
            <ThemedText type="title" style={styles.title}>
              {t('avo_score.modal.title')}
            </ThemedText>

            <Text style={[styles.sectionHeader, { color: colors.text }]}>
              {t('avo_score.modal.section_grades')}
            </Text>
            <View style={styles.gradesList}>
              {GRADES.map((grade) => (
                <View key={grade} style={styles.gradeRow}>
                  <Text style={[styles.gradeLetter, { color: getAvoScoreGradeColor(grade, colors) }]}>
                    {grade}
                  </Text>
                  <Text style={[styles.gradeSentence, { color: colors.text }]}>
                    {t(`avo_score.modal.grade.${grade}`)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.divider, { backgroundColor: colors.separator }]} />

            <Text style={[styles.sectionHeader, { color: colors.text }]}>
              {t('avo_score.modal.section_what')}
            </Text>
            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.bodyScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.bodyText, { color: colors.text }]}>
                {t('avo_score.modal.body')}
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.gotItButton,
                { backgroundColor: colors.tint },
                getMinTouchTargetStyle(),
                ...(Platform.OS === 'web' ? [getFocusStyle('#fff')] : []),
              ]}
              onPress={onClose}
              activeOpacity={0.8}
              {...getButtonAccessibilityProps(
                t('common.got_it'),
                'Close AvoScore info'
              )}
            >
              <Text style={styles.gotItButtonText}>{t('common.got_it')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)' },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  gradesList: {
    marginBottom: Spacing.sm,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  gradeLetter: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    minWidth: 24,
  },
  gradeSentence: {
    fontSize: FontSize.sm,
    flex: 1,
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: Spacing.md,
  },
  bodyScroll: {
    maxHeight: 180,
  },
  bodyScrollContent: {
    paddingBottom: Spacing.sm,
  },
  bodyText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  gotItButton: {
    marginTop: Spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  gotItButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
