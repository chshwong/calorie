import * as React from "react";
import { useEffect } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function LoginScreen() {
  const { user, loading, onboardingComplete } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState<null | "signin" | "signup">(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Reactive redirect: navigate based on onboarding status when user signs in
  useEffect(() => {
    if (!loading && user) {
      // Wait for profile to load (onboardingComplete !== null)
      if (onboardingComplete === null) {
        return; // Still loading profile
      }
      // Route based on onboarding status
      if (onboardingComplete) {
        router.replace("/(tabs)/today");
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

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
      <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 12 }}>
        AvoVibe
      </Text>
      <Text style={{ fontSize: 16, opacity: 0.7, marginBottom: 32 }}>
        Native app (v1)
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={submitting === null}
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 12,
          paddingVertical: 14,
          paddingHorizontal: 16,
          fontSize: 16,
          marginBottom: 16,
          backgroundColor: submitting !== null ? "#f5f5f5" : "#fff",
        }}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={submitting === null}
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 12,
          paddingVertical: 14,
          paddingHorizontal: 16,
          fontSize: 16,
          marginBottom: 24,
          backgroundColor: submitting !== null ? "#f5f5f5" : "#fff",
        }}
      />

      <Pressable
        onPress={handleSignIn}
        disabled={submitting !== null}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 12,
          alignItems: "center",
          backgroundColor: submitting !== null ? "#999" : "#111",
          opacity: submitting !== null ? 0.6 : 1,
          marginBottom: 12,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
          {submitting === "signin" ? "Signing in..." : "Sign in"}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleSignUp}
        disabled={submitting !== null}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 12,
          alignItems: "center",
          backgroundColor: submitting !== null ? "#999" : "#eee",
          opacity: submitting !== null ? 0.6 : 1,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "600" }}>
          {submitting === "signup" ? "Creating account..." : "Create account"}
        </Text>
      </Pressable>

      {message && (
        <Text style={{ fontSize: 14, opacity: 0.8, marginTop: 16, textAlign: "center" }}>
          {message}
        </Text>
      )}

      {error && (
        <Text style={{ fontSize: 14, fontWeight: "600", opacity: 0.8, marginTop: 16, textAlign: "center" }}>
          {error}
        </Text>
      )}

      <Text style={{ fontSize: 14, opacity: 0.6, marginTop: 24, textAlign: "center" }}>
        {loading ? "Auth: loading..." : user ? `Auth: signed in (${user.email})` : "Auth: signed out"}
      </Text>
    </View>
  );
}
