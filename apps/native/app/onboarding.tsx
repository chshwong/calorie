import { Redirect } from "expo-router";
import * as React from "react";

export default function OnboardingScreen() {
  // Native app: onboarding must use the web version wrapped in WebView.
  return <Redirect href="/web-onboarding" />;
}

