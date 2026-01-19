import AICameraPic from '@/assets/images/AI_CAMERA_PIC.png';
import { showAppToast } from '@/components/ui/app-toast';
import { Colors, SemanticColors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { parseAIQuickLogReply, type AIQuickLogParsed } from '@/lib/ai/aiQuickLogParser';
import { getButtonAccessibilityProps, getInputAccessibilityProps, getLinkAccessibilityProps, getMinTouchTargetStyle, getWebAccessibilityProps } from '@/utils/accessibility';
import { Asset } from 'expo-asset';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StepConnectorDown } from './StepConnectorDown';

type Props = {
  onApplyParsed: (input: { parsed: AIQuickLogParsed; rawText: string }) => void;
  onClearAi: () => void;
  onParseErrorAnnouncement?: (message: string) => void;
};

export function AIQuickLogTab({ onApplyParsed, onClearAi, onParseErrorAnnouncement }: Props) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const errorColor = SemanticColors.error;
  const warningColor = SemanticColors.warning;

  const replyInputRef = useRef<TextInput>(null);
  const [aiReplyText, setAiReplyText] = useState('');
  const [errors, setErrors] = useState<Array<{ field: string; message: string }>>([]);
  const [warnings, setWarnings] = useState<Array<{ field: string; message: string }>>([]);

  const promptText = useMemo(() => t('quick_log.ai.prompt'), [t]);
  const aiCameraPicUri = Asset.fromModule(AICameraPic).uri;

  const handleCopyPrompt = async () => {
    try {
      // Web Clipboard API (V1: Web-only)
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(promptText);
        showAppToast(t('quick_log.ai.copy_prompt_success'));
        return;
      }
      // Fallback for older browsers
      if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = promptText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showAppToast(t('quick_log.ai.copy_prompt_success'));
        return;
      }
      throw new Error('Clipboard API not available');
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Failed to copy AI prompt', err);
      }
      showAppToast(t('common.unexpected_error'));
    }
  };

  const handleClear = () => {
    setAiReplyText('');
    setErrors([]);
    setWarnings([]);
    onClearAi();
    replyInputRef.current?.focus?.();
  };

  const handleParseAndFill = () => {
    setErrors([]);
    setWarnings([]);

    const result = parseAIQuickLogReply(aiReplyText);
    if (!result.ok) {
      setErrors(result.errors.map((e) => ({ field: e.field, message: e.message })));
      setWarnings(result.warnings.map((w) => ({ field: w.field, message: w.message })));

      const announce = result.errors.map((e) => e.message).join(' ');
      onParseErrorAnnouncement?.(announce || t('quick_log.ai.parse_error_fallback_announcement'));

      // Best-effort focus: keep user in the paste field (predictable + SR announcement).
      replyInputRef.current?.focus?.();
      return;
    }

    setWarnings(result.warnings.map((w) => ({ field: w.field, message: w.message })));

    onApplyParsed({
      parsed: result.data,
      rawText: aiReplyText,
    });
  };

  const handleOpenLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Failed to open URL:', url, err);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.card : colors.background }]}>
      <View style={styles.content}>
        {/* Disclaimer */}
        <View style={styles.disclaimerBlock}>
          <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
            {t('quick_log.ai.disclaimer')}
          </Text>
          {Platform.OS === 'web' ? (
            <div
              style={{
                width: '100%',
                maxWidth: 520,
                margin: '0 auto 8px',
                borderRadius: 16,
                overflow: 'hidden',
                aspectRatio: '16 / 9',
              }}
            >
              <img
                src={aiCameraPicUri}
                alt="AI camera food logging flow"
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  objectFit: 'cover',
                  opacity: 0.95,
                }}
              />
            </div>
          ) : null}
        </View>

        {/* STEP 1 */}
        <View style={styles.step}>
          <Text style={[styles.stepHeader, { color: colors.text }]}>
            {t('quick_log.ai.step1_header')}
          </Text>
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            {t('quick_log.ai.step1_helper')}
          </Text>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.icon + '30' }, getMinTouchTargetStyle()]}
            onPress={handleCopyPrompt}
            activeOpacity={0.7}
            {...getButtonAccessibilityProps(t('quick_log.ai.copy_prompt_accessibility_label'))}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              {t('quick_log.ai.copy_prompt_button')}
            </Text>
          </TouchableOpacity>
        </View>

        <StepConnectorDown />

        {/* STEP 2 */}
        <View style={styles.step}>
          <Text style={[styles.stepHeader, { color: colors.text }]}>
            {t('quick_log.ai.step2_header')}
          </Text>
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            {t('quick_log.ai.step2_helper_prefix')}{' '}
            <Text
              onPress={() => handleOpenLink('https://chat.openai.com')}
              style={[styles.linkText, { color: colors.tint }]}
              {...getLinkAccessibilityProps('ChatGPT', 'Opens ChatGPT in browser')}
            >
              ChatGPT
            </Text>
            {' or '}
            <Text
              onPress={() => handleOpenLink('https://gemini.google.com')}
              style={[styles.linkText, { color: colors.tint }]}
              {...getLinkAccessibilityProps('Gemini', 'Opens Google Gemini in browser')}
            >
              Gemini
            </Text>
            {' '}
            {t('quick_log.ai.step2_helper_suffix')}
          </Text>
        </View>

        <StepConnectorDown />

        {/* STEP 3 */}
        <View style={styles.step}>
          <Text style={[styles.stepHeader, { color: colors.text }]}>
            {t('quick_log.ai.step3_header')}
          </Text>
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            {t('quick_log.ai.step3_helper')}
          </Text>
          <TextInput
            ref={replyInputRef}
            style={[
              styles.replyInput,
              {
                color: isDark ? colors.inputTextDark : colors.text,
                backgroundColor: colors.inputBackground,
                borderColor: errors.length > 0 ? errorColor : colors.icon + '20',
              },
            ]}
            value={aiReplyText}
            onChangeText={setAiReplyText}
            placeholder={t('quick_log.ai.paste_reply_placeholder')}
            placeholderTextColor={colors.textTertiary}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            {...getInputAccessibilityProps(
              t('quick_log.ai.paste_reply_accessibility_label'),
              t('quick_log.ai.paste_reply_accessibility_hint'),
              errors.length > 0 ? errors[0]?.message : undefined,
              false
            )}
            {...getWebAccessibilityProps('textbox', t('quick_log.ai.paste_reply_accessibility_label'))}
          />
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: colors.tint },
                getMinTouchTargetStyle(),
              ]}
              onPress={handleParseAndFill}
              activeOpacity={0.8}
              {...getButtonAccessibilityProps(t('quick_log.ai.parse_accessibility_label'))}
            >
              <Text style={[styles.primaryButtonText, { color: colors.textOnTint }]}>
                {t('quick_log.ai.parse_button')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.icon + '30' }, getMinTouchTargetStyle()]}
              onPress={handleClear}
              activeOpacity={0.7}
              {...getButtonAccessibilityProps(t('quick_log.ai.clear_accessibility_label'))}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                {t('quick_log.ai.clear_button')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Error / warning region (visible + announced via screen-level live region) */}
        {errors.length > 0 ? (
          <View
            style={[styles.messageBox, { borderColor: errorColor, backgroundColor: SemanticColors.errorLight }]}
            {...getWebAccessibilityProps('status')}
          >
            <Text style={[styles.messageTitle, { color: errorColor }]}>
              {t('quick_log.ai.parse_failed_title')}
            </Text>
            {errors.map((e, idx) => (
              <Text key={`${e.field}-${idx}`} style={[styles.messageLine, { color: colors.text }]}>
                {e.message}
              </Text>
            ))}
          </View>
        ) : null}

        {warnings.length > 0 ? (
          <View
            style={[styles.messageBox, { borderColor: warningColor, backgroundColor: SemanticColors.warningLight }]}
            {...getWebAccessibilityProps('status')}
          >
            <Text style={[styles.messageTitle, { color: warningColor }]}>
              {t('quick_log.ai.warnings_title')}
            </Text>
            {warnings.map((w, idx) => (
              <Text key={`${w.field}-${idx}`} style={[styles.messageLine, { color: colors.text }]}>
                {w.message}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    paddingVertical: 4,
  },
  content: {
    paddingHorizontal: Spacing.xs,
    gap: 0,
  },
  disclaimerBlock: {
    gap: 6,
  },
  disclaimer: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    marginBottom: 0,
  },
  step: {
    gap: 8,
  },
  stepHeader: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  linkText: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  inputBlock: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  replyInput: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  messageBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  messageTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  messageLine: {
    fontSize: 14,
    lineHeight: 20,
  },
});

