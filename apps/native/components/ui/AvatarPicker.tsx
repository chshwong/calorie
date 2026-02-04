import * as ImagePicker from "expo-image-picker";
import React from "react";
import { Image, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../theme/tokens";
import { useColorScheme } from "../useColorScheme";
import { Button } from "./Button";
import { Text } from "./Text";

type AvatarPickerProps = {
  uri: string | null;
  onChange: (uri: string | null) => void;
  size?: number;
};

export function AvatarPicker({ uri, onChange, size = 96 }: AvatarPickerProps) {
  const scheme = useColorScheme() ?? "light";
  const theme = colors[scheme];

  const handlePick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    const nextUri = result.assets?.[0]?.uri ?? null;
    onChange(nextUri);
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.preview,
          {
            width: size,
            height: size,
            borderColor: theme.border,
            backgroundColor: theme.surface,
          },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={[styles.image, { width: size, height: size }]} />
        ) : (
          <Text tone="muted">Add photo</Text>
        )}
      </View>
      <Button title={uri ? "Change photo" : "Choose photo"} variant="secondary" onPress={handlePick} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.md,
  },
  preview: {
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    resizeMode: "cover",
  },
});
