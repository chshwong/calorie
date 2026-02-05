import { supabase } from "@/lib/supabase";

type NativeSessionMessage = {
  type: "NATIVE_SESSION";
  access_token?: string;
  refresh_token?: string;
};

function isNativeWrapperRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const container = (window as any).__AVOVIBE_CONTAINER__;
  const type = String(container?.type ?? "");
  return type === "native" || type === "native_onboarding";
}

function postToNative(message: string) {
  if (typeof window === "undefined") return;
  const rn = (window as any).ReactNativeWebView;
  if (rn && typeof rn.postMessage === "function") {
    rn.postMessage(message);
  }
}

async function applyNativeSession(msg: NativeSessionMessage): Promise<boolean> {
  const access_token = msg.access_token;
  const refresh_token = msg.refresh_token;
  if (!access_token || !refresh_token) return false;

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (error) return false;
  return !!data.session;
}

/**
 * Installs the native→web auth bridge when running inside the native WebView wrapper.
 *
 * - Registers a function (`window.__AVOVIBE_APPLY_NATIVE_SESSION__`) that native can call.
 * - Requests native session if web is unauthenticated.
 */
export function setupNativeWrapperAuthBridgeOnce() {
  if (!isNativeWrapperRuntime()) return;

  // Avoid double-registering listeners.
  if ((window as any).__AVOVIBE_NATIVE_AUTH_BRIDGE_INSTALLED__) return;
  (window as any).__AVOVIBE_NATIVE_AUTH_BRIDGE_INSTALLED__ = true;

  (window as any).__AVOVIBE_APPLY_NATIVE_SESSION__ = async (raw: any) => {
    const msg = raw as NativeSessionMessage;
    const ok = await applyNativeSession(msg);
    if (ok) {
      postToNative("NATIVE_SESSION_APPLIED");
    } else {
      // If native couldn't provide a valid session (or tokens expired),
      // force the native flow. Web login must never appear in wrapper mode.
      postToNative("NEED_NATIVE_LOGIN");
    }
  };

  // If native already posted a session before we installed the apply function, apply it now.
  const existing = (window as any).__AVOVIBE_NATIVE_SESSION__ as NativeSessionMessage | null;
  if (existing?.type === "NATIVE_SESSION") {
    void (window as any).__AVOVIBE_APPLY_NATIVE_SESSION__(existing);
    return;
  }

  // Otherwise, request it.
  postToNative("REQUEST_NATIVE_SESSION");
}

export function isNativeWrapper(): boolean {
  return isNativeWrapperRuntime();
}

