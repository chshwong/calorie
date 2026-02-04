import React, { useMemo } from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { useTranslation } from "react-i18next";

import { colors, spacing } from "@/theme/tokens";
import { Text } from "@/components/ui/Text";
import { useColorScheme } from "@/components/useColorScheme";

type BrandLogoNameOnlyProps = ViewProps & {
  textVariant?: "title" | "body" | "label" | "caption";
};

export function BrandLogoNameOnly({
  textVariant = "title",
  style,
  ...props
}: BrandLogoNameOnlyProps) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];
  const brandName = t("auth.login.brand_name");
  const brandParts = useMemo(() => {
    const avo = brandName.slice(0, 3);
    const vibe = brandName.slice(3);
    return { avo, vibe };
  }, [brandName]);

  return (
    <View style={[styles.container, style]} {...props}>
      <Text variant={textVariant} style={{ color: theme.brandAvo }}>
        {brandParts.avo}
      </Text>
      <Text variant={textVariant} style={{ color: theme.brandVibe }}>
        {brandParts.vibe}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
});
