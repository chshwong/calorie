import { useFocusEffect } from "@react-navigation/native";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Alert, BackHandler, Platform } from "react-native";
import type { WebViewNavigation } from "react-native-webview";

import { WrappedWebView } from "./web";

export default function WebOnboardingScreen() {
  const { t } = useTranslation();
  const webRef = React.useRef<any>(null);
  const canGoBackRef = React.useRef(false);
  const pendingOnboardingBackRef = React.useRef(false);
  const pendingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNavChange = React.useCallback((navState: WebViewNavigation) => {
    canGoBackRef.current = !!navState.canGoBack;
  }, []);

  const showExitModal = React.useCallback(() => {
    Alert.alert(t("native.exit_app.title"), t("native.exit_app.body"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("native.exit_app.confirm"), style: "destructive", onPress: () => BackHandler.exitApp() },
    ]);
  }, [t]);

  const requestOnboardingStepBack = React.useCallback(() => {
    pendingOnboardingBackRef.current = true;
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
    }
    pendingTimeoutRef.current = setTimeout(() => {
      if (!pendingOnboardingBackRef.current) return;
      pendingOnboardingBackRef.current = false;
      showExitModal();
    }, 400);

    webRef.current?.postMessage?.(JSON.stringify({ type: "NATIVE_ONBOARDING_BACK" }));
  }, [showExitModal]);

  const handleWebMessage = React.useCallback(
    (data: string) => {
      let msg: any = null;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }

      if (msg?.type === "NATIVE_ONBOARDING_BACK_RESULT") {
        pendingOnboardingBackRef.current = false;
        if (pendingTimeoutRef.current) {
          clearTimeout(pendingTimeoutRef.current);
          pendingTimeoutRef.current = null;
        }

        if (msg.handled === false) {
          showExitModal();
        }
      }
    },
    [showExitModal]
  );

  React.useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS !== "android") return;

      const onBackPress = () => {
        if (canGoBackRef.current && webRef.current?.goBack) {
          webRef.current.goBack();
          return true;
        }

        requestOnboardingStepBack();
        return true;
      };

      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => sub.remove();
    }, [])
  );

  return (
    <WrappedWebView
      initialPath="/onboarding"
      allowOnboardingPaths={true}
      containerType="native_onboarding"
      webRef={webRef}
      canGoBackRef={canGoBackRef}
      onWebNavigationStateChange={handleNavChange}
      onWebMessage={handleWebMessage}
    />
  );
}

