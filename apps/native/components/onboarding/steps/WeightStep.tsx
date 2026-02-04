import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import { HeroCard } from "@/components/onboarding/HeroCard";
import { OnboardingErrorBox } from "@/components/onboarding/OnboardingErrorBox";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { ChoiceTile } from "@/components/ui/ChoiceTile";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";
import { ReferenceModal } from "@/components/ui/ReferenceModal";
import { getAgeFromDob } from "@/lib/dates/dobRules";
import { PROFILES } from "@/constants/constraints";
import { kgToLb, lbToKg, roundTo1 } from "@/lib/domain/conversions";
import { APP_MAX_CURRENT_WEIGHT_LB, APP_MIN_CURRENT_WEIGHT_LB } from "@/lib/domain/weight-constants";
import { limitBodyFatInput, limitWeightInput, roundTo2, roundTo3, WeightUnit } from "@/lib/validation/weight";
import { colors, spacing } from "@/theme/tokens";

type WeightStepProps = {
  currentWeightKg: string;
  currentWeightLb: string;
  currentWeightUnit: WeightUnit;
  bodyFatPercent: string;
  sexAtBirth: "male" | "female" | "" | null;
  dateOfBirth: string;
  onCurrentWeightKgChange: (value: string) => void;
  onCurrentWeightLbChange: (value: string) => void;
  onCurrentWeightUnitChange: (unit: WeightUnit) => void;
  onBodyFatPercentChange: (value: string) => void;
  onErrorClear: () => void;
  error: string | null;
  loading: boolean;
  onBack: () => void;
  onContinue: () => void;
};

export function WeightStep({
  currentWeightKg,
  currentWeightLb,
  currentWeightUnit,
  bodyFatPercent,
  sexAtBirth,
  dateOfBirth,
  onCurrentWeightKgChange,
  onCurrentWeightLbChange,
  onCurrentWeightUnitChange,
  onBodyFatPercentChange,
  onErrorClear,
  error,
  loading,
  onBack,
  onContinue,
}: WeightStepProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const [isReferenceOpen, setReferenceOpen] = useState(false);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeGroup>("15_29");
  const modalInitRef = useRef(false);
  const ageYears = getAgeFromDob(dateOfBirth);
  const normalizedSex = sexAtBirth === "male" || sexAtBirth === "female" ? sexAtBirth : null;

  const isGlobalWeightValid = useMemo(() => {
    if (currentWeightUnit === "kg") {
      const kg = parseFloat(currentWeightKg);
      const minKg = roundTo1(lbToKg(APP_MIN_CURRENT_WEIGHT_LB));
      const maxKg = roundTo1(lbToKg(APP_MAX_CURRENT_WEIGHT_LB));
      return !isNaN(kg) && kg > 0 && kg >= minKg && kg <= maxKg;
    }
    const lb = parseFloat(currentWeightLb);
    return (
      !isNaN(lb) &&
      lb > 0 &&
      lb >= APP_MIN_CURRENT_WEIGHT_LB &&
      lb <= APP_MAX_CURRENT_WEIGHT_LB
    );
  }, [currentWeightKg, currentWeightLb, currentWeightUnit]);

  const isBodyFatGlobalValid = useMemo(() => {
    if (!bodyFatPercent.trim()) return true;
    const bf = parseFloat(bodyFatPercent);
    return !isNaN(bf) && bf > 0 && bf <= PROFILES.BODY_FAT_PERCENT.MAX;
  }, [bodyFatPercent]);

  const handleUnitChange = (unit: WeightUnit) => {
    if (unit === currentWeightUnit) return;
    onCurrentWeightUnitChange(unit);
    if (unit === "kg") {
      if (currentWeightLb.trim()) {
        const lbs = parseFloat(currentWeightLb);
        if (!isNaN(lbs)) {
        onCurrentWeightKgChange(roundTo1(lbToKg(lbs)).toString());
        }
      }
    } else {
      if (currentWeightKg.trim()) {
        const kg = parseFloat(currentWeightKg);
        if (!isNaN(kg)) {
        onCurrentWeightLbChange(roundTo1(kgToLb(kg)).toString());
        }
      }
    }
    onErrorClear();
  };

  const handleKgChange = (text: string) => {
    const sanitized = limitWeightInput(text);
    onCurrentWeightKgChange(sanitized);
    onErrorClear();
  };

  const handleLbChange = (text: string) => {
    const sanitized = limitWeightInput(text);
    onCurrentWeightLbChange(sanitized);
    onErrorClear();
  };

  const handleBodyFatChange = (text: string) => {
    const sanitized = limitBodyFatInput(text);
    onBodyFatPercentChange(sanitized);
    onErrorClear();
  };

  const nextDisabled = !isGlobalWeightValid || !isBodyFatGlobalValid || loading;

  useEffect(() => {
    if (isReferenceOpen && !modalInitRef.current) {
      const mapped = mapAgeToDefaultAgeGroup(ageYears);
      if (mapped) {
        setSelectedAgeGroup(mapped);
      }
      modalInitRef.current = true;
    } else if (!isReferenceOpen && modalInitRef.current) {
      modalInitRef.current = false;
    }
  }, [isReferenceOpen, ageYears]);

  return (
    <OnboardingShell
      step={5}
      totalSteps={12}
      title={t("onboarding.current_weight.title")}
      subtitle={t("onboarding.current_weight.subtitle")}
      hero={
        <HeroCard>
          <View style={styles.heroVisual}>
            <MaterialCommunityIcons name="scale-bathroom" size={128} color={theme.primary} />
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
            disabled={nextDisabled}
            loading={loading}
          />
        </View>
      }
    >
      <View style={styles.section}>
        <View style={styles.unitToggle}>
          <ChoiceTile
            title={t("units.kg")}
            selected={currentWeightUnit === "kg"}
            onPress={() => handleUnitChange("kg")}
            disabled={loading}
            variant="compact"
            showCheck={false}
            style={styles.unitTile}
            accessibilityRole="radio"
            accessibilityState={{ selected: currentWeightUnit === "kg" }}
          />
          <ChoiceTile
            title={t("units.lbs")}
            selected={currentWeightUnit === "lb"}
            onPress={() => handleUnitChange("lb")}
            disabled={loading}
            variant="compact"
            showCheck={false}
            style={styles.unitTile}
            accessibilityRole="radio"
            accessibilityState={{ selected: currentWeightUnit === "lb" }}
          />
        </View>

        <View style={styles.singleInput}>
          <Input
            label={`${t("onboarding.current_weight.weight_label")} (${currentWeightUnit === "kg" ? t("units.kg") : t("units.lbs")})`}
            value={currentWeightUnit === "kg" ? currentWeightKg : currentWeightLb}
            onChangeText={currentWeightUnit === "kg" ? handleKgChange : handleLbChange}
            placeholder={
              currentWeightUnit === "kg"
                ? t("units.kg")
                : t("units.lbs")
            }
            keyboardType="decimal-pad"
            editable={!loading}
            accessibilityLabel={
              currentWeightUnit === "kg"
                ? t("onboarding.current_weight.weight_kg_placeholder")
                : t("onboarding.current_weight.weight_lb_placeholder")
            }
          />
        </View>

        <View style={styles.singleInput}>
          <View style={styles.bodyFatHeader}>
            <Text variant="label" tone="muted">
              {t("onboarding.current_weight.body_fat_label")}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setReferenceOpen(true)}
              disabled={loading}
            >
              <Text variant="label" tone="primary">
                {t("onboarding.current_weight.body_fat_reference_label")}
              </Text>
            </Pressable>
          </View>
          <Input
            value={bodyFatPercent}
            onChangeText={handleBodyFatChange}
            placeholder={t("onboarding.current_weight.body_fat_placeholder")}
            keyboardType="decimal-pad"
            editable={!loading}
            accessibilityLabel={t("onboarding.current_weight.body_fat_accessibility_label")}
            accessibilityHint={t("onboarding.current_weight.body_fat_accessibility_hint")}
          />
        </View>

        {error ? <OnboardingErrorBox message={t(error)} /> : null}
      </View>
      <ReferenceModal
        visible={isReferenceOpen}
        onClose={() => setReferenceOpen(false)}
        title={t("onboarding.current_weight.body_fat_modal.title", {
          symbol: normalizedSex
            ? t(`onboarding.current_weight.body_fat_modal.symbols.${normalizedSex}`)
            : "",
        })}
        subtitle={t("onboarding.current_weight.body_fat_modal.subtitle")}
        closeLabel={t("common.close")}
      >
        {normalizedSex ? (
          <>
            <View style={styles.ageGroupRow}>
              {AGE_GROUPS.map((ageGroup) => (
                <ChoiceTile
                  key={ageGroup}
                  title={t(`onboarding.current_weight.body_fat_modal.age_groups.${ageGroup}`)}
                  selected={selectedAgeGroup === ageGroup}
                  onPress={() => setSelectedAgeGroup(ageGroup)}
                  variant="compact"
                  showCheck={false}
                  style={styles.ageGroupTile}
                />
              ))}
            </View>
            <View style={styles.chart}>
              {BODY_FAT_RANGES[normalizedSex][selectedAgeGroup].map((row) => (
                <View key={row.category} style={styles.chartRow}>
                  <Text variant="body">{t(row.category)}</Text>
                  <Text variant="body">
                    {"max" in row
                      ? t("onboarding.current_weight.body_fat_modal.range_span", {
                          min: row.min,
                          max: row.max,
                        })
                      : t("onboarding.current_weight.body_fat_modal.range_plus", {
                          min: row.min,
                        })}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text variant="caption" tone="muted">
            {t("onboarding.current_weight.body_fat_modal.no_sex")}
          </Text>
        )}
        <Text variant="caption" tone="muted">
          {t("onboarding.current_weight.body_fat_modal.disclaimer")}
        </Text>
      </ReferenceModal>
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
  bodyFatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actions: {
    gap: spacing.md,
  },
  centerText: {
    textAlign: "center",
  },
  ageGroupRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  ageGroupTile: {
    minWidth: "48%",
  },
  chart: {
    gap: spacing.sm,
  },
  chartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

export function buildWeightPayload(
  unit: WeightUnit,
  weightKg: string,
  weightLb: string,
  bodyFatPercent: string
) {
  if (unit === "kg") {
    const kg = parseFloat(weightKg);
    const lb = roundTo3(kgToLb(kg));
    return {
      weightLb: lb,
      weightUnit: "kg" as const,
      bodyFatPercent: bodyFatPercent.trim() ? roundTo2(parseFloat(bodyFatPercent)) : undefined,
    };
  }
  const lb = parseFloat(weightLb);
  return {
    weightLb: roundTo3(lb),
    weightUnit: "lbs" as const,
    bodyFatPercent: bodyFatPercent.trim() ? roundTo2(parseFloat(bodyFatPercent)) : undefined,
  };
}

type AgeGroup = "15_29" | "30s" | "40_50s" | "60_plus";

const AGE_GROUPS: AgeGroup[] = ["15_29", "30s", "40_50s", "60_plus"];

const BODY_FAT_RANGES = {
  male: {
    "15_29": [
      { category: "onboarding.current_weight.body_fat_modal.categories.athlete", min: 6, max: 10 },
      { category: "onboarding.current_weight.body_fat_modal.categories.ideal", min: 11, max: 14 },
      { category: "onboarding.current_weight.body_fat_modal.categories.average", min: 15, max: 20 },
      { category: "onboarding.current_weight.body_fat_modal.categories.above_average", min: 21, max: 24 },
      { category: "onboarding.current_weight.body_fat_modal.categories.overweight", min: 25 },
    ],
    "30s": [
      { category: "onboarding.current_weight.body_fat_modal.categories.athlete", min: 7, max: 11 },
      { category: "onboarding.current_weight.body_fat_modal.categories.ideal", min: 12, max: 15 },
      { category: "onboarding.current_weight.body_fat_modal.categories.average", min: 16, max: 22 },
      { category: "onboarding.current_weight.body_fat_modal.categories.above_average", min: 23, max: 26 },
      { category: "onboarding.current_weight.body_fat_modal.categories.overweight", min: 27 },
    ],
    "40_50s": [
      { category: "onboarding.current_weight.body_fat_modal.categories.athlete", min: 8, max: 12 },
      { category: "onboarding.current_weight.body_fat_modal.categories.ideal", min: 13, max: 16 },
      { category: "onboarding.current_weight.body_fat_modal.categories.average", min: 17, max: 23 },
      { category: "onboarding.current_weight.body_fat_modal.categories.above_average", min: 24, max: 27 },
      { category: "onboarding.current_weight.body_fat_modal.categories.overweight", min: 28 },
    ],
    "60_plus": [
      { category: "onboarding.current_weight.body_fat_modal.categories.athlete", min: 9, max: 13 },
      { category: "onboarding.current_weight.body_fat_modal.categories.ideal", min: 14, max: 17 },
      { category: "onboarding.current_weight.body_fat_modal.categories.average", min: 18, max: 24 },
      { category: "onboarding.current_weight.body_fat_modal.categories.above_average", min: 25, max: 28 },
      { category: "onboarding.current_weight.body_fat_modal.categories.overweight", min: 29 },
    ],
  },
  female: {
    "15_29": [
      { category: "onboarding.current_weight.body_fat_modal.categories.athlete", min: 14, max: 19 },
      { category: "onboarding.current_weight.body_fat_modal.categories.ideal", min: 20, max: 24 },
      { category: "onboarding.current_weight.body_fat_modal.categories.average", min: 25, max: 31 },
      { category: "onboarding.current_weight.body_fat_modal.categories.above_average", min: 32, max: 35 },
      { category: "onboarding.current_weight.body_fat_modal.categories.overweight", min: 36 },
    ],
    "30s": [
      { category: "onboarding.current_weight.body_fat_modal.categories.athlete", min: 15, max: 20 },
      { category: "onboarding.current_weight.body_fat_modal.categories.ideal", min: 21, max: 25 },
      { category: "onboarding.current_weight.body_fat_modal.categories.average", min: 26, max: 32 },
      { category: "onboarding.current_weight.body_fat_modal.categories.above_average", min: 33, max: 36 },
      { category: "onboarding.current_weight.body_fat_modal.categories.overweight", min: 37 },
    ],
    "40_50s": [
      { category: "onboarding.current_weight.body_fat_modal.categories.athlete", min: 16, max: 21 },
      { category: "onboarding.current_weight.body_fat_modal.categories.ideal", min: 22, max: 26 },
      { category: "onboarding.current_weight.body_fat_modal.categories.average", min: 27, max: 33 },
      { category: "onboarding.current_weight.body_fat_modal.categories.above_average", min: 34, max: 37 },
      { category: "onboarding.current_weight.body_fat_modal.categories.overweight", min: 38 },
    ],
    "60_plus": [
      { category: "onboarding.current_weight.body_fat_modal.categories.athlete", min: 17, max: 22 },
      { category: "onboarding.current_weight.body_fat_modal.categories.ideal", min: 23, max: 27 },
      { category: "onboarding.current_weight.body_fat_modal.categories.average", min: 28, max: 34 },
      { category: "onboarding.current_weight.body_fat_modal.categories.above_average", min: 35, max: 38 },
      { category: "onboarding.current_weight.body_fat_modal.categories.overweight", min: 39 },
    ],
  },
} as const;

function mapAgeToDefaultAgeGroup(ageYears: number | null | undefined): AgeGroup | null {
  if (ageYears === null || ageYears === undefined || !isFinite(ageYears)) return null;
  if (ageYears <= 29) return "15_29";
  if (ageYears >= 30 && ageYears <= 39) return "30s";
  if (ageYears >= 40 && ageYears <= 59) return "40_50s";
  if (ageYears >= 60) return "60_plus";
  return null;
}
