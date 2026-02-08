import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { router } from "expo-router";
import * as React from "react";
import { useEffect } from "react";
import { Image, Linking, ScrollView, StyleSheet, View } from "react-native";

import { clearPendingAuthState, getOAuthRedirectTo, setPendingAuthState } from "@/lib/auth/oauth";
import { sendMagicLink, signInWithOAuth } from "@/lib/services/auth";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Screen } from "../components/ui/Screen";
import { Text } from "../components/ui/Text";
import { useColorScheme } from "../components/useColorScheme";
import { getDeviceRegion } from "../lib/region/getDeviceRegion";
import { colors, spacing } from "../theme/tokens";

export default function LoginScreen() {
  const { user, loading, onboardingComplete } = useAuth();
  const colorScheme = useColorScheme() ?? "light";
  const theme = colors[colorScheme];
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState<null | "signin" | "signup">(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [magicLoading, setMagicLoading] = React.useState(false);
  const [magicSent, setMagicSent] = React.useState(false);
  const [googleError, setGoogleError] = React.useState<string | null>(null);
  const [magicError, setMagicError] = React.useState<string | null>(null);
  const [deviceRegion, setDeviceRegion] = React.useState<string | null>(null);

  const emailValid = email.trim().toLowerCase().includes("@");
  const passwordValid = password.length >= 6;
  const busy = submitting !== null || googleLoading || magicLoading;

  useEffect(() => {
    const region = getDeviceRegion();
    setDeviceRegion(region);
    if (__DEV__) {
      console.log("Device region:", region ?? "unknown");
    }
  }, []);

  // Reactive redirect: ALWAYS funnel post-auth to PostLoginGate
  useEffect(() => {
    if (!loading && user) {
      // Wait for profile to load (onboardingComplete !== null)
      if (onboardingComplete === null) {
        return; // Still loading profile
      }
      router.replace("/post-login-gate");
    }
  }, [loading, user, onboardingComplete]);

  const handleSignIn = async () => {
    if (busy) return;

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
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleSignUp = async () => {
    if (busy) return;

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
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleGoogleLogin = async () => {
    if (busy) return;
    setGoogleError(null);
    setMagicError(null);
    setMagicSent(false);
    setGoogleLoading(true);

    try {
      const redirectTo = getOAuthRedirectTo();
      await setPendingAuthState({
        stage: "auth_start",
        provider: "google",
        startedAt: Date.now(),
      });

      const { data, error: oauthError } = await signInWithOAuth({
        provider: "google",
        redirectTo,
        queryParams: { prompt: "select_account" },
      });

      if (oauthError) {
        await clearPendingAuthState();
        setGoogleError(oauthError.message || "Failed to start Google sign-in.");
        return;
      }

      const authUrl = data?.url;
      if (!authUrl) {
        await clearPendingAuthState();
        setGoogleError("Missing Google sign-in URL. Please try again.");
        return;
      }

      await setPendingAuthState({
        stage: "awaiting_callback",
        provider: "google",
        startedAt: Date.now(),
      });

      await Linking.openURL(authUrl);
    } catch {
      await clearPendingAuthState();
      setGoogleError("Network error. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSendMagicLink = async () => {
    if (busy) return;
    setMagicError(null);
    setMagicSent(false);
    setMagicLoading(true);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setMagicLoading(false);
      setMagicError("Please enter a valid email address.");
      return;
    }

    try {
      const redirectTo = getOAuthRedirectTo();
      await setPendingAuthState({
        stage: "awaiting_callback",
        provider: "magic",
        startedAt: Date.now(),
      });

      const { error: magicLinkError } = await sendMagicLink({
        email: trimmedEmail,
        emailRedirectTo: redirectTo,
      });

      if (magicLinkError) {
        await clearPendingAuthState();
        const message = magicLinkError.message?.toLowerCase() ?? "";
        if (message.includes("rate") || message.includes("too many")) {
          setMagicError("Too many requests. Please wait a few minutes and try again.");
        } else {
          setMagicError("Could not send magic link. Please try again.");
        }
        return;
      }

      setMagicSent(true);
    } catch {
      await clearPendingAuthState();
      setMagicError("Network error. Please try again.");
    } finally {
      setMagicLoading(false);
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
              onChangeText={(value) => {
                setEmail(value);
                setError(null);
                setMagicError(null);
                setMagicSent(false);
              }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={submitting === null}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError(null);
              }}
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
              disabled={busy || !emailValid || !passwordValid}
            />

            <Button
              variant="secondary"
              title={submitting === "signup" ? "Creating account..." : "Create account"}
              loading={submitting === "signup"}
              onPress={handleSignUp}
              disabled={busy || !emailValid || !passwordValid}
            />

            {message ? (
              <Text tone="muted" style={styles.centerText}>
                {message}
              </Text>
            ) : null}
          </View>
        </Card>

        <Card>
          <View style={styles.socialBlock}>
            <Text variant="body" style={styles.sectionTitle}>
              Social / Magic Link
            </Text>

            <Button
              title={googleLoading ? "Continuing..." : "Continue with Google"}
              loading={googleLoading}
              onPress={handleGoogleLogin}
              disabled={busy}
            />
            {googleError ? (
              <Text tone="danger" style={styles.centerText}>
                {googleError}
              </Text>
            ) : null}

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <Text tone="muted">or</Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            <Text tone="muted" style={styles.centerText}>
              Use the email above to receive a sign-in link.
            </Text>

            <Button
              variant="secondary"
              title={magicLoading ? "Sending..." : "Email me a magic link"}
              loading={magicLoading}
              onPress={handleSendMagicLink}
              disabled={busy || !emailValid}
            />

            {magicError ? (
              <Text tone="danger" style={styles.centerText}>
                {magicError}
              </Text>
            ) : null}

            {magicSent ? (
              <Text tone="muted" style={styles.centerText}>
                Check your email for a sign-in link.
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
  socialBlock: {
    gap: spacing.md,
  },
  sectionTitle: {
    textAlign: "center",
    fontWeight: "700",
  },
  centerText: {
    textAlign: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
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
