import * as React from "react";

import { WrappedWebView } from "./web";

export default function WebOnboardingScreen() {
  return (
    <WrappedWebView
      initialPath="/onboarding"
      allowOnboardingPaths={true}
      containerType="native_onboarding"
    />
  );
}

