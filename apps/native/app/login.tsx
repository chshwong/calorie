import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { router } from "expo-router";
import * as React from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { clearPendingAuthState, getOAuthRedirectTo, setPendingAuthState } from "@/lib/auth/oauth";
import { sendMagicLink, signInWithOAuth } from "@/lib/services/auth";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Text } from "../components/ui/Text";
import { useColorScheme } from "../components/useColorScheme";
import { colors, opacity, radius, spacing } from "../theme/tokens";

const LEGAL = {
  privacy: "https://avovibe.app/legal/privacy",
  terms: "https://avovibe.app//legal/terms",
  health: "https://avovibe.app/legal/health",
};

export default function LoginScreen() {
  const { t } = useTranslation();
  const { user, loading, onboardingComplete } = useAuth();
  const colorScheme = useColorScheme() ?? "light";
  const theme = colors[colorScheme];
  const insets = useSafeAreaInsets();
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
  const [emailFocused, setEmailFocused] = React.useState(false);

  const emailValid = email.trim().toLowerCase().includes("@");
  const busy = submitting !== null || googleLoading || magicLoading;

  const cardStyle = [
    styles.actionsCard,
    {
      borderRadius: radius.xl,
      backgroundColor: theme.card,
      borderColor: theme.border,
      shadowColor: theme.text,
      shadowOpacity: opacity.muted,
      shadowRadius: spacing.xl,
      shadowOffset: { width: 0, height: spacing.md },
      elevation: spacing.md,
    },
  ];

  const openExternal = async (url: string) => {
    try {
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
    } catch {}
  };

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
      setError(t("auth.login.native.errors.invalid_email"));
      return;
    }
    if (!password || password.length < 6) {
      setError(t("auth.login.error_invalid_credentials"));
      return;
    }

    setSubmitting("signin");

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        setError(signInError.message || t("auth.login.native.errors.google_start_failed"));
        return;
      }

      // Success: AuthContext will update, and useEffect will navigate to /home
    } catch {
      setError(t("auth.login.native.errors.network"));
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
      setError(t("auth.login.native.errors.invalid_email"));
      return;
    }
    if (!password || password.length < 6) {
      setError(t("auth.login.error_invalid_credentials"));
      return;
    }

    setSubmitting("signup");

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (signUpError) {
        setError(signUpError.message || t("auth.login.native.errors.magic_link_failed"));
        return;
      }

      // Check if email confirmation is required
      // If signUp succeeds but no session, email confirmation is likely ON
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage(t("auth.login.native.magic_link_sent"));
      } else {
        // Email confirmation is OFF; user is signed in immediately
        // AuthContext will update, and useEffect will navigate to /home
      }
    } catch {
      setError(t("auth.login.native.errors.network"));
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
        setGoogleError(oauthError.message || t("auth.login.native.errors.google_start_failed"));
        return;
      }

      const authUrl = data?.url;
      if (!authUrl) {
        await clearPendingAuthState();
        setGoogleError(t("auth.login.native.errors.google_missing_url"));
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
      setGoogleError(t("auth.login.native.errors.network"));
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
      setMagicError(t("auth.login.native.errors.invalid_email"));
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
          setMagicError(t("auth.login.native.errors.magic_link_rate_limited"));
        } else {
          setMagicError(t("auth.login.native.errors.magic_link_failed"));
        }
        return;
      }

      setMagicSent(true);
    } catch {
      await clearPendingAuthState();
      setMagicError(t("auth.login.native.errors.network"));
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Image
                source={require("../assets/images/brand/Logo_MascotOnly.png")}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel={t("auth.login.brand_logo_alt")}
              />
              <Text variant="title" style={styles.title}>
                {t("auth.login.native.title")}
              </Text>
              <Text tone="muted" style={styles.subtitle}>
                {t("auth.login.native.subtitle")}
              </Text>
            </View>

            <Card style={cardStyle}>
              <View style={styles.actions}>
                <Button
                  loading={googleLoading}
                  onPress={handleGoogleLogin}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { shadowColor: theme.text },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <FontAwesome name="google" size={18} color={theme.primaryText} />
                  <Text style={[styles.buttonLabel, { color: theme.primaryText }]}>
                    {googleLoading
                      ? t("auth.login.native.google_loading")
                      : t("auth.login.google_sign_in")}
                  </Text>
                </Button>

                {googleError ? (
                  <Text tone="danger" style={styles.centerText}>
                    {googleError}
                  </Text>
                ) : null}

                <View style={styles.dividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                  <Text tone="muted">{t("auth.login.native.divider_or")}</Text>
                  <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                </View>

                <Input
                  label={t("auth.login.email_label")}
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setError(null);
                    setMagicError(null);
                    setMagicSent(false);
                  }}
                  placeholder={t("auth.login.email_placeholder_short")}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  editable={!busy}
                  containerStyle={styles.fullWidth}
                  style={[
                    styles.emailInput,
                    emailFocused && { borderColor: theme.primary },
                  ]}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />

                <Text tone="muted" style={styles.helperText}>
                  {t("auth.login.native.magic_link_helper")}
                </Text>

                <Button
                  variant="secondary"
                  title={
                    magicLoading
                      ? t("auth.login.native.magic_link_sending")
                      : t("auth.login.native.magic_link_send")
                  }
                  loading={magicLoading}
                  onPress={handleSendMagicLink}
                  disabled={busy || !emailValid}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                />

                {magicError ? (
                  <Text tone="danger" style={styles.centerText}>
                    {magicError}
                  </Text>
                ) : null}

                {magicSent ? (
                  <Text tone="muted" style={styles.centerText}>
                    {t("auth.login.native.magic_link_sent")}
                  </Text>
                ) : null}

                {error ? (
                  <Text tone="danger" style={styles.centerText}>
                    {error}
                  </Text>
                ) : null}

                {message ? (
                  <Text tone="muted" style={styles.centerText}>
                    {message}
                  </Text>
                ) : null}
              </View>
            </Card>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              {t("auth.login.native.footer_legal")}
            </Text>
            <View style={styles.footerLinksRow}>
              <Pressable onPress={() => openExternal(LEGAL.privacy)} hitSlop={8}>
                <Text style={[styles.footerLink, { color: theme.primary }]}>
                  {t("auth.login.native.footer_privacy")}
                </Text>
              </Pressable>
              <Text style={[styles.footerDot, { color: theme.textMuted }]}>·</Text>
              <Pressable onPress={() => openExternal(LEGAL.terms)} hitSlop={8}>
                <Text style={[styles.footerLink, { color: theme.primary }]}>
                  {t("auth.login.native.footer_terms")}
                </Text>
              </Pressable>
              <Text style={[styles.footerDot, { color: theme.textMuted }]}>·</Text>
              <Pressable onPress={() => openExternal(LEGAL.health)} hitSlop={8}>
                <Text style={[styles.footerLink, { color: theme.primary }]}>
                  {t("auth.login.native.footer_health")}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={{ height: Math.max(insets.bottom, spacing.lg) }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    gap: spacing.xl,
  },
  header: {
    alignItems: "center",
    gap: spacing.sm,
  },
  logo: {
    width: spacing.xxl * 2,
    height: spacing.xxl * 2,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
  actionsCard: {
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  actions: {
    gap: spacing.md,
    alignItems: "center",
  },
  fullWidth: {
    width: "100%",
  },
  emailInput: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
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
  helperText: {
    textAlign: "center",
  },
  primaryButton: {
    width: "100%",
    borderRadius: radius.lg,
    paddingVertical: spacing.md + spacing.xs,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  secondaryButton: {
    width: "100%",
    borderRadius: radius.lg,
  },
  buttonPressed: {
    opacity: opacity.image,
    transform: [{ scale: 0.99 }],
  },
  buttonLabel: {
    fontWeight: "600",
  },
  centerText: {
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  footerText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
    textAlign: "center",
  },
  footerLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  footerLink: {
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  footerDot: {
    fontSize: 13,
    marginHorizontal: 8,
  },
});
