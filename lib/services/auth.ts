import { supabase } from '@/lib/supabase';
import type { Provider } from '@supabase/supabase-js';

/**
 * Auth service layer
 *
 * Engineering guideline:
 * - Components must not call Supabase directly. All auth calls are centralized here.
 *
 * Notes:
 * - On web, Supabase OAuth flows perform a full-page redirect to the provider and back.
 * - Callers should set UI loading state and assume navigation may occur.
 */

export type OAuthProvider = Extract<Provider, 'google' | 'facebook'>;

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
      // Do NOT set skipBrowserRedirect on web; we want Supabase to handle redirects
      // without our code using window.location.* (engineering guideline #14).
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

export async function getSession() {
  return supabase.auth.getSession();
}

export async function getUser() {
  return supabase.auth.getUser();
}

export async function getUserIdentities() {
  return supabase.auth.getUserIdentities();
}

export async function linkIdentity(params: { provider: OAuthProvider; redirectTo?: string }) {
  return supabase.auth.linkIdentity({
    provider: params.provider,
    options: {
      redirectTo: params.redirectTo,
      // Do NOT set skipBrowserRedirect on web; let Supabase handle it.
    },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}


