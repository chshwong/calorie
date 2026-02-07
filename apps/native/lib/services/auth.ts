import { supabase } from "@/lib/supabaseClient";
import type { Provider } from "@supabase/supabase-js";

export type OAuthProvider = Extract<Provider, "google" | "facebook">;

export async function signInWithOAuth(params: {
  provider: OAuthProvider;
  redirectTo?: string;
  queryParams?: Record<string, string>;
}) {
  return supabase.auth.signInWithOAuth({
    provider: params.provider,
    options: {
      redirectTo: params.redirectTo,
      queryParams: params.queryParams,
      // Native must receive the URL and handle the browser/deep link itself.
      skipBrowserRedirect: true,
    },
  });
}

export async function sendMagicLink(params: { email: string; emailRedirectTo?: string }) {
  return supabase.auth.signInWithOtp({
    email: params.email,
    options: {
      emailRedirectTo: params.emailRedirectTo,
    },
  });
}

export async function exchangeCodeForSession(code: string) {
  return supabase.auth.exchangeCodeForSession(code);
}

export async function setSession(params: { access_token: string; refresh_token: string }) {
  return supabase.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token,
  });
}
