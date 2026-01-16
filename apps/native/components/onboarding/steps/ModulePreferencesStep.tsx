import React, { useMemo, useRef, useState, useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Feather from "@expo/vector-icons/Feather";

import { HeroCard } from "@/components/onboarding/HeroCard";
import { OnboardingErrorBox } from "@/components/onboarding/OnboardingErrorBox";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { colors, radius, spacing } from "@/theme/tokens";

export type ModulePreference = "Exercise" | "Med" | "Water";

type ModulePreferencesStepProps = {
  profile: {
    focus_module_2: ModulePreference | null;
    focus_module_3: ModulePreference | null;
  } | null;
  selections: ModulePreference[];
  loading: boolean;
  error: string | null;
  onSelectionsChange: (modules: ModulePreference[]) => void;
  onErrorClear: () => void;
  onBack: () => void;
  onContinue: () => void;
};

const MODULE_OPTIONS: Array<{
  key: ModulePreference;
  titleKey: string;
  subtitleKey: string;
}> = [
  {
    key: "Exercise",
    titleKey: "onboarding.module_preferences.exercise_title",
    subtitleKey: "onboarding.module_preferences.exercise_subtitle",
  },
  {
    key: "Med",
    titleKey: "onboarding.module_preferences.med_title",
    subtitleKey: "onboarding.module_preferences.med_subtitle",
  },
  {
    key: "Water",
    titleKey: "onboarding.module_preferences.water_title",
    subtitleKey: "onboarding.module_preferences.water_subtitle",
  },
];

const MAX_SELECTIONS = 2;

export function ModulePreferencesStep({
  profile,
  selections,
  loading,
  error,
  onSelectionsChange,
  onErrorClear,
  onBack,
  onContinue,
}: ModulePreferencesStepProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const prefillRef = useRef(false);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  useEffect(() => {
    if (prefillRef.current) return;
    if (!profile) return;
    if (selections.length > 0) {
      prefillRef.current = true;
      return;
    }
    const picks: ModulePreference[] = [];
    const add = (value: ModulePreference | null) => {
      if (!value) return;
      if (!picks.includes(value)) {
        picks.push(value);
      }
    };
    add(profile.focus_module_2);
    add(profile.focus_module_3);
    prefillRef.current = true;
    onSelectionsChange(picks.slice(0, MAX_SELECTIONS));
  }, [profile, selections.length, onSelectionsChange]);

  const selectedSet = useMemo(() => new Set(selections), [selections]);

  const toggle = (option: ModulePreference) => {
    onErrorClear();
    setLimitMessage(null);

    if (selectedSet.has(option)) {
      onSelectionsChange(selections.filter((item) => item !== option));
      return;
    }

    if (selections.length >= MAX_SELECTIONS) {
      setLimitMessage(t("onboarding.module_preferences.pick_up_to_2"));
      return;
    }

    onSelectionsChange([...selections, option]);
  };

  const getRank = (option: ModulePreference) => {
    const index = selections.indexOf(option);
    return index >= 0 ? index + 1 : null;
  };

  return (
    <OnboardingShell
      step={10}
      totalSteps={12}
      title={t("onboarding.module_preferences.title")}
      subtitle={t("onboarding.module_preferences.subtitle")}
      hero={
        <HeroCard>
          <View style={styles.heroVisual}>
            <Feather name="layers" size={56} color={theme.primary} />
          </View>
        </HeroCard>
      }
    >
      <View style={styles.section}>
        <View style={styles.optionList}>
          {MODULE_OPTIONS.map((option) => {
            const selected = selectedSet.has(option.key);
            const rank = getRank(option.key);

            return (
              <Pressable
                key={option.key}
                onPress={() => toggle(option.key)}
                disabled={loading}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: loading }}
                accessibilityLabel={
                  rank
                    ? `${t(option.titleKey)} ${t("onboarding.module_preferences.selected_rank", { rank })}`
                    : t(option.titleKey)
                }
                accessibilityHint={t("onboarding.module_preferences.tap_to_toggle")}
                style={({ pressed }) => [
                  styles.pressable,
                  pressed && styles.pressablePressed,
                  loading && styles.pressableDisabled,
                ]}
              >
                <Card
                  style={[
                    styles.card,
                    {
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected ? theme.surface : theme.card,
                      shadowColor: theme.text,
                    },
                  ]}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardText}>
                      <Text variant="label">{t(option.titleKey)}</Text>
                      <Text tone="muted" variant="caption">
                        {t(option.subtitleKey)}
                      </Text>
                    </View>
                    {rank ? (
                      <View style={[styles.rankBadge, { backgroundColor: theme.primary }]}>
                        <Text style={[styles.rankText, { color: theme.primaryText }]}>
                          {rank}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>

        {limitMessage ? (
          <Text variant="caption" tone="muted" style={styles.centerText}>
            {limitMessage}
          </Text>
        ) : null}

        {error ? <OnboardingErrorBox message={t(error)} /> : null}

        <View style={styles.actions}>
          <Button title={t("common.back")} variant="secondary" onPress={onBack} disabled={loading} />
          <Button title={t("common.next")} onPress={onContinue} disabled={loading} loading={loading} />
        </View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.lg,
  },
  heroVisual: {
    alignItems: "center",
    justifyContent: "center",
  },
  optionList: {
    gap: spacing.md,
  },
  pressable: {
    width: "100%",
  },
  pressablePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  pressableDisabled: {
    opacity: 0.7,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  cardText: {
    flex: 1,
    gap: spacing.xs,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontWeight: "700",
  },
  actions: {
    gap: spacing.md,
  },
  centerText: {
    textAlign: "center",
  },
});
