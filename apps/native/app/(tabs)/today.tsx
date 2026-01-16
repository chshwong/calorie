import { useAuth } from "@/contexts/AuthContext";
import { useTodaySummary } from "@/lib/today/useTodaySummary";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { spacing } from "@/theme/tokens";

export default function TodayScreen() {
  const { t } = useTranslation();
  const { user, loading: loadingAuth } = useAuth();
  const { status, data, error, refresh } = useTodaySummary(user?.id ?? null);
  const isLoading = status === "loading";
  const entriesCount = data?.entries ?? 0;
  const entryLabel =
    entriesCount === 1
      ? t("home.summary.entry_one", { count: entriesCount })
      : t("home.summary.entry_other", { count: entriesCount });

  return (
    <Screen>
      <View style={styles.container}>
        <Text variant="title" style={styles.title}>
          {t("home.summary.title_today")}
        </Text>

        {loadingAuth ? (
          <Text tone="muted">{t("common.loading")}</Text>
        ) : !user ? (
          <Text tone="muted">{t("home.done_for_today.not_authenticated")}</Text>
        ) : (
          <>
            {status === "loading" ? (
              <Text tone="muted">{t("home.summary.loading_entries")}</Text>
            ) : null}

            {status === "error" ? (
              <Text tone="danger">
                {error ? error : t("common.unexpected_error")}
              </Text>
            ) : null}

            <Card style={styles.summaryCard}>
              <View style={styles.row}>
                <Text variant="label">{t("home.summary.total_calories")}</Text>
                <Text variant="label">{data?.calories ?? 0}</Text>
              </View>
              <View style={styles.row}>
                <Text tone="muted">{t("home.summary.protein")}</Text>
                <Text tone="muted">{data?.protein ?? 0}</Text>
              </View>
              <View style={styles.row}>
                <Text tone="muted">{t("home.summary.carbs")}</Text>
                <Text tone="muted">{data?.carbs ?? 0}</Text>
              </View>
              <View style={styles.row}>
                <Text tone="muted">{t("home.summary.fat")}</Text>
                <Text tone="muted">{data?.fat ?? 0}</Text>
              </View>
              <View style={styles.row}>
                <Text tone="muted">{t("home.summary.fiber")}</Text>
                <Text tone="muted">{data?.fiber ?? 0}</Text>
              </View>
              <View style={styles.row}>
                <Text tone="muted">{entryLabel}</Text>
              </View>
            </Card>

            <Button
              title={t("legal.refresh")}
              variant="secondary"
              onPress={refresh}
              loading={isLoading}
              disabled={isLoading}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.lg,
  },
  title: {
    textAlign: "center",
  },
  summaryCard: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
