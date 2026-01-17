import React, { useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import HeightRulerImage from "@/assets/height_ruler.png";

import { HeroCard } from "@/components/onboarding/HeroCard";
import { OnboardingErrorBox } from "@/components/onboarding/OnboardingErrorBox";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { ChoiceTile } from "@/components/ui/ChoiceTile";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { filterNumericInput } from "@/lib/validation/inputFilters";
import { roundTo1 } from "@/lib/domain/conversions";
import { convertHeightToCm, validateHeightInputs } from "@/lib/onboarding/height-validation";
import { cmToFtIn, HeightUnit } from "@/lib/validation/height";
import { spacing, opacity, imageSizes } from "@/theme/tokens";

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
          <View style={styles.heroContainer}>
            <Image
              source={HeightRulerImage}
              resizeMode="contain"
              style={styles.heroImage}
            />
          </View>
        </HeroCard>
      }
      footer={
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
              placeholder={t("units.cm")}
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
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.lg,
  },
  heroContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: {
    width: imageSizes.heroIllustration.width,
    height: imageSizes.heroIllustration.height,
    opacity: opacity.image,
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
