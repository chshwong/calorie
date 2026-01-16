import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { HeroCard } from "@/components/onboarding/HeroCard";
import { OnboardingErrorBox } from "@/components/onboarding/OnboardingErrorBox";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { ChoiceTile } from "@/components/ui/ChoiceTile";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { filterNumericInput } from "@/lib/validation/inputFilters";
import { roundTo1 } from "@/lib/domain/conversions";
import { convertHeightToCm, validateHeightInputs } from "@/lib/onboarding/height-validation";
import { cmToFtIn, HeightUnit } from "@/lib/validation/height";
import { colors, spacing } from "@/theme/tokens";

type HeightStepProps = {
  heightCm: string;
  heightFt: string;
  heightIn: string;
  heightUnit: HeightUnit;
  onHeightCmChange: (value: string) => void;
  onHeightFtChange: (value: string) => void;
  onHeightInChange: (value: string) => void;
  onHeightUnitChange: (unit: HeightUnit) => void;
  onErrorClear: () => void;
  error: string | null;
  loading: boolean;
  onBack: () => void;
  onContinue: () => void;
};

export function HeightStep({
  heightCm,
  heightFt,
  heightIn,
  heightUnit,
  onHeightCmChange,
  onHeightFtChange,
  onHeightInChange,
  onHeightUnitChange,
  onErrorClear,
  error,
  loading,
  onBack,
  onContinue,
}: HeightStepProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  const validation = useMemo(
    () => validateHeightInputs(heightUnit, heightCm, heightFt, heightIn),
    [heightUnit, heightCm, heightFt, heightIn]
  );

  const handleUnitChange = (unit: HeightUnit) => {
    if (unit === heightUnit) return;
    onHeightUnitChange(unit);
    if (unit === "cm") {
      const ft = heightFt.trim() ? parseFloat(heightFt) : NaN;
      const inches = heightIn.trim() ? parseFloat(heightIn) : NaN;
      if (!isNaN(ft) && !isNaN(inches) && ft > 0 && inches >= 0) {
        const cmValue = convertHeightToCm("ft/in", "", heightFt, heightIn);
        if (cmValue !== null) {
          onHeightCmChange(roundTo1(cmValue).toString());
        }
      } else {
        onHeightCmChange("");
      }
    } else {
      const cmValue = heightCm.trim() ? parseFloat(heightCm) : NaN;
      if (!isNaN(cmValue) && cmValue > 0) {
        const result = cmToFtIn(cmValue);
        if (result) {
          onHeightFtChange(result.feet.toString());
          onHeightInChange(result.inches.toString());
        }
      } else {
        onHeightFtChange("");
        onHeightInChange("");
      }
    }
    onErrorClear();
  };

  const handleCmChange = (text: string) => {
    const sanitized = filterNumericInput(text);
    onHeightCmChange(sanitized);
    onErrorClear();
  };

  const handleFtChange = (text: string) => {
    const sanitized = filterNumericInput(text);
    onHeightFtChange(sanitized);
    onErrorClear();
  };

  const handleInChange = (text: string) => {
    const sanitized = filterNumericInput(text);
    onHeightInChange(sanitized);
    onErrorClear();
  };

  return (
    <OnboardingShell
      step={3}
      totalSteps={12}
      title={t("onboarding.height.title")}
      subtitle={t("onboarding.height.subtitle")}
      hero={
        <HeroCard>
          <View style={[styles.heroVisual, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.ruler, { backgroundColor: withAlpha(theme.primary, 0.2) }]}>
              {RULER_TICKS.map((index) => (
                <View
                  key={index}
                  style={[
                    styles.tick,
                    { backgroundColor: withAlpha(theme.primary, index % 2 === 0 ? 0.85 : 0.55) },
                  ]}
                />
              ))}
              <View
                style={[styles.indicator, { backgroundColor: theme.primary }]}
              />
            </View>
          </View>
        </HeroCard>
      }
    >
      <View style={styles.section}>
        <View style={styles.unitToggle}>
          <ChoiceTile
            title={t("units.cm")}
            selected={heightUnit === "cm"}
            onPress={() => handleUnitChange("cm")}
            disabled={loading}
            variant="compact"
            showCheck={false}
            style={styles.unitTile}
            accessibilityRole="radio"
            accessibilityState={{ selected: heightUnit === "cm" }}
          />
          <ChoiceTile
            title={t("units.ft_in")}
            selected={heightUnit === "ft/in"}
            onPress={() => handleUnitChange("ft/in")}
            disabled={loading}
            variant="compact"
            showCheck={false}
            style={styles.unitTile}
            accessibilityRole="radio"
            accessibilityState={{ selected: heightUnit === "ft/in" }}
          />
        </View>

        {heightUnit === "cm" ? (
          <View style={styles.singleInput}>
            <Input
              label={`${t("onboarding.height.height_label")} (${t("units.cm")})`}
              value={heightCm}
              onChangeText={handleCmChange}
              placeholder={t("onboarding.height.height_cm_placeholder")}
              keyboardType="numeric"
              editable={!loading}
            />
          </View>
        ) : (
          <View style={styles.dualInput}>
            <Text variant="label" tone="muted" style={styles.groupLabel}>
              {t("onboarding.height.height_label")}
            </Text>
            <View style={styles.dualRow}>
              <Input
                label={t("units.ft")}
                value={heightFt}
                onChangeText={handleFtChange}
                placeholder={t("onboarding.height.height_ft_placeholder")}
                keyboardType="numeric"
                editable={!loading}
                containerStyle={styles.dualField}
              />
              <Input
                label={t("units.in")}
                value={heightIn}
                onChangeText={handleInChange}
                placeholder={t("onboarding.height.height_in_placeholder")}
                keyboardType="numeric"
                editable={!loading}
                containerStyle={styles.dualField}
              />
            </View>
          </View>
        )}

    {error ? <OnboardingErrorBox message={t(error)} /> : null}

        <View style={styles.actions}>
          <Button
            title={t("common.back")}
            variant="secondary"
            onPress={onBack}
            disabled={loading}
          />
          <Button
            title={t("common.next")}
            onPress={onContinue}
            disabled={loading || !validation.ok}
            loading={loading}
          />
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
    width: "75%",
    height: "75%",
    borderRadius: spacing.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ruler: {
    width: spacing.md,
    height: "80%",
    borderRadius: spacing.md,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    position: "relative",
  },
  tick: {
    width: "70%",
    height: 2,
    borderRadius: 2,
  },
  indicator: {
    position: "absolute",
    left: "50%",
    top: "52%",
    width: "140%",
    height: 3,
    borderRadius: 3,
    transform: [{ translateX: -spacing.sm }],
  },
  unitToggle: {
    flexDirection: "row",
    gap: spacing.md,
  },
  unitTile: {
    flex: 1,
  },
  singleInput: {
    width: "100%",
  },
  dualInput: {
    width: "100%",
    gap: spacing.sm,
  },
  groupLabel: {
    marginBottom: spacing.xs,
  },
  dualRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  dualField: {
    flex: 1,
  },
  actions: {
    gap: spacing.md,
  },
  centerText: {
    textAlign: "center",
  },
});

const RULER_TICKS = [0, 1, 2, 3, 4];

function withAlpha(color: string, alpha: number) {
  const normalized = color.replace("#", "");
  if (normalized.length !== 6) {
    return color;
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
