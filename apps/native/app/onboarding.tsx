import * as React from "react";
import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { router, Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function OnboardingScreen() {
  const { user, loading, onboardingComplete, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "not_telling" | "">("");
  const [heightCm, setHeightCm] = useState("");
  const [weightLb, setWeightLb] = useState("");

  // Auth and onboarding guards
  if (loading) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 16, opacity: 0.7 }}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  // Profile is still loading
  if (onboardingComplete === null) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 16, opacity: 0.7 }}>Loading...</Text>
      </View>
    );
  }

  // User already completed onboarding
  if (onboardingComplete === true) {
    return <Redirect href="/(tabs)/today" />;
  }

  const handleSubmit = async () => {
    if (!user) return;

    // Basic validation - check required fields are filled
    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }
    if (!dateOfBirth.trim()) {
      setError("Date of birth is required");
      return;
    }
    if (!gender) {
      setError("Gender is required");
      return;
    }
    if (!heightCm.trim()) {
      setError("Height is required");
      return;
    }
    if (!weightLb.trim()) {
      setError("Weight is required");
      return;
    }

    // Parse numeric values
    const heightCmNum = parseFloat(heightCm);
    const weightLbNum = parseFloat(weightLb);

    if (isNaN(heightCmNum) || heightCmNum <= 0) {
      setError("Height must be a valid number");
      return;
    }
    if (isNaN(weightLbNum) || weightLbNum <= 0) {
      setError("Weight must be a valid number");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Update required fields and set onboarding_complete = true in one operation
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim(),
          date_of_birth: dateOfBirth.trim(),
          gender: gender,
          height_cm: heightCmNum,
          weight_lb: weightLbNum,
          onboarding_complete: true,
        })
        .eq("user_id", user.id);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      // Verify the update succeeded by re-selecting onboarding_complete
      const { data: verifyData, error: verifyError } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("user_id", user.id)
        .single();

      if (verifyError) {
        setError(`Failed to verify update: ${verifyError.message}`);
        setSaving(false);
        return;
      }

      if (verifyData?.onboarding_complete !== true) {
        setError("Update failed: onboarding_complete is not true after update");
        setSaving(false);
        return;
      }

      // Refresh profile in AuthContext to update onboardingComplete
      await refreshProfile();

      setSuccess("Onboarding completed!");
      
      // Redirect to today tab after a brief delay
      setTimeout(() => {
        router.replace("/(tabs)/today");
      }, 1000);
    } catch (e: any) {
      setError(e?.message || "An unexpected error occurred");
      setSaving(false);
    }
  };

  // Safety check: guard should redirect, but handle brief null state
  if (!user) {
    return null;
  }

  return (
    <ScrollView style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 12 }}>
        Complete Onboarding
      </Text>
      <Text style={{ fontSize: 16, opacity: 0.7, marginBottom: 24 }}>
        Please provide the following information to complete your profile.
      </Text>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 8 }}>
          First Name *
        </Text>
        <TextInput
          value={firstName}
          onChangeText={setFirstName}
          placeholder="Enter your first name"
          style={{
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 8 }}>
          Date of Birth *
        </Text>
        <TextInput
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          placeholder="YYYY-MM-DD"
          style={{
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 8 }}>
          Gender *
        </Text>
        <View style={{ flexDirection: "row" }}>
          <Pressable
            onPress={() => setGender("male")}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: gender === "male" ? "#007bff" : "#ddd",
              backgroundColor: gender === "male" ? "#e7f3ff" : "#fff",
              alignItems: "center",
              marginRight: 6,
            }}
          >
            <Text style={{ fontSize: 14 }}>Male</Text>
          </Pressable>
          <Pressable
            onPress={() => setGender("female")}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: gender === "female" ? "#007bff" : "#ddd",
              backgroundColor: gender === "female" ? "#e7f3ff" : "#fff",
              alignItems: "center",
              marginHorizontal: 6,
            }}
          >
            <Text style={{ fontSize: 14 }}>Female</Text>
          </Pressable>
          <Pressable
            onPress={() => setGender("not_telling")}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: gender === "not_telling" ? "#007bff" : "#ddd",
              backgroundColor: gender === "not_telling" ? "#e7f3ff" : "#fff",
              alignItems: "center",
              marginLeft: 6,
            }}
          >
            <Text style={{ fontSize: 14 }}>Prefer not to say</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 8 }}>
          Height (cm) *
        </Text>
        <TextInput
          value={heightCm}
          onChangeText={setHeightCm}
          placeholder="Enter height in centimeters"
          keyboardType="numeric"
          style={{
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 8 }}>
          Weight (lbs) *
        </Text>
        <TextInput
          value={weightLb}
          onChangeText={setWeightLb}
          placeholder="Enter weight in pounds"
          keyboardType="numeric"
          style={{
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
        />
      </View>

      {error && (
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#dc3545", marginBottom: 16 }}>
          Error: {error}
        </Text>
      )}

      {success && (
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#28a745", marginBottom: 16 }}>
          {success}
        </Text>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={saving}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 12,
          alignItems: "center",
          backgroundColor: saving ? "#999" : "#007bff",
          opacity: saving ? 0.6 : 1,
          marginTop: 8,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
          {saving ? "Saving..." : "Save & Complete Onboarding"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
