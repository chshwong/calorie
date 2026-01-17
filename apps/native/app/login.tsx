import * as React from "react";
import { useEffect } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Screen } from "../components/ui/Screen";
import { Text } from "../components/ui/Text";
import { getDeviceRegion } from "../lib/region/getDeviceRegion";
import { spacing } from "../theme/tokens";

export default function LoginScreen() {
  const { user, loading, onboardingComplete } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState<null | "signin" | "signup">(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [deviceRegion, setDeviceRegion] = React.useState<string | null>(null);

  useEffect(() => {
    const region = getDeviceRegion();
    setDeviceRegion(region);
    if (__DEV__) {
      console.log("Device region:", region ?? "unknown");
    }
  }, []);

  // Reactive redirect: navigate based on onboarding status when user signs in
  useEffect(() => {
    if (!loading && user) {
      // Wait for profile to load (onboardingComplete !== null)
      if (onboardingComplete === null) {
        return; // Still loading profile
      }
      // Route based on onboarding status
      if (onboardingComplete) {
        router.replace("/(tabs)");
      } else {
        router.replace("/onboarding");
      }
    }
  }, [loading, user, onboardingComplete]);

  const handleSignIn = async () => {
    if (submitting) return;

    console.log("SIGNIN pressed", email);

    // Clear previous messages
    setMessage(null);
    setError(null);

    // Validation
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setSubmitting("signin");

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        setError(signInError.message || "Failed to sign in");
        return;
      }

      // Success: AuthContext will update, and useEffect will navigate to /home
    } catch (e: any) {
      setError(e?.message || "An unexpected error occurred");
    } finally {
      setSubmitting(null);
    }
  };

  const handleSignUp = async () => {
    if (submitting) return;

    console.log("SIGNUP pressed", email);

    // Clear previous messages
    setMessage(null);
    setError(null);

    // Validation
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setSubmitting("signup");

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (signUpError) {
        setError(signUpError.message || "Failed to create account");
        return;
      }

      // Check if email confirmation is required
      // If signUp succeeds but no session, email confirmation is likely ON
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage("Account created. Check your email to confirm, then sign in.");
      } else {
        // Email confirmation is OFF; user is signed in immediately
        // AuthContext will update, and useEffect will navigate to /home
      }
    } catch (e: any) {
      setError(e?.message || "An unexpected error occurred");
    } finally {
      setSubmitting(null);
    }
  };

  const isCanada = deviceRegion === "CA";

  return (
    <Screen padding={0}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="AvoVibe logo"
          />
          <Text variant="title" style={styles.heroTitle}>
            {isCanada
              ? "Simple nutrition tracking, built for Canadians."
              : "Simple nutrition tracking that stays out of your way."}
          </Text>
          <Text tone="muted" style={styles.subtitle}>
            Log fast. No costs. No upsells. Just fitness and health.
          </Text>
        </View>

        <Card>
          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={submitting === null}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={submitting === null}
            />

            {error ? (
              <Text tone="danger" style={styles.centerText}>
                {error}
              </Text>
            ) : null}

            <Button
              title={submitting === "signin" ? "Signing in..." : "Sign in"}
              loading={submitting === "signin"}
              onPress={handleSignIn}
              disabled={submitting !== null}
            />

            <Button
              variant="secondary"
              title={submitting === "signup" ? "Creating account..." : "Create account"}
              loading={submitting === "signup"}
              onPress={handleSignUp}
              disabled={submitting !== null}
            />

            {message ? (
              <Text tone="muted" style={styles.centerText}>
                {message}
              </Text>
            ) : null}
          </View>
        </Card>

        <Card>
          <View style={styles.marketing}>
            <Text variant="body" style={styles.marketingTitle}>
              Fitness made simple
            </Text>
            <View style={styles.bullet}>
              <Text style={styles.bulletIcon}>⚡</Text>
              <Text>Simple. Reliable. Build great habits.</Text>
            </View>
            <View style={styles.bullet}>
              <Text style={styles.bulletIcon}>📊</Text>
              <Text>Track nutrition, activity, and goals.</Text>
            </View>
            <View style={styles.bullet}>
              <Text style={styles.bulletIcon}>🔒</Text>
              <Text>Engineered for health, not paywalls.</Text>
            </View>
            {isCanada ? (
              <View style={styles.bullet}>
                <Text style={styles.bulletIcon}>🇨🇦</Text>
                <Text>Built with Canadian values.</Text>
              </View>
            ) : null}
          </View>
        </Card>

        <View style={styles.socialProof}>
          <Text tone="muted" style={styles.socialItem}>
            ✅ Designed for real life
          </Text>
          <Text tone="muted" style={styles.socialItem}>
            ✅ Simple insights, no noise
          </Text>
          <Text tone="muted" style={styles.socialItem}>
            ✅ Your data stays yours
          </Text>
        </View>

        <Text tone="muted" style={styles.authStatus}>
          {loading ? "Auth: loading..." : user ? `Auth: signed in (${user.email})` : "Auth: signed out"}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    alignItems: "center",
    gap: spacing.sm,
  },
  logo: {
    width: 72,
    height: 72,
  },
  heroTitle: {
    textAlign: "center",
  },
  subtitle: {
    marginTop: spacing.xs,
    textAlign: "center",
  },
  form: {
    gap: spacing.md,
  },
  centerText: {
    textAlign: "center",
  },
  marketing: {
    gap: spacing.sm,
  },
  marketingTitle: {
    fontWeight: "700",
  },
  bullet: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  bulletIcon: {
    width: 24,
    textAlign: "center",
  },
  socialProof: {
    gap: spacing.sm,
    alignItems: "center",
  },
  socialItem: {
    textAlign: "center",
  },
  authStatus: {
    textAlign: "center",
  },
});
