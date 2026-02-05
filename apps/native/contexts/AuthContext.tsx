import { supabase } from "@/lib/supabaseClient";
import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  onboardingComplete: boolean | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  onboardingComplete: null,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  const fetchProfile = async (userId: string) => {
    setOnboardingComplete(null);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("user_id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116" || error.message.includes("No rows")) {
          setOnboardingComplete(false);
          return;
        }

        if (process.env.NODE_ENV !== "production") {
          console.warn("[AuthContext] Failed to load profile:", error.message);
        }
        setOnboardingComplete(false);
        return;
      }

      setOnboardingComplete(data?.onboarding_complete === true);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[AuthContext] Profile fetch error:", error);
      }
      setOnboardingComplete(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          void fetchProfile(session.user.id);
        } else {
          setOnboardingComplete(null);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[AuthContext] Failed to get session:", error);
        }
        if (!isMounted) return;
        setSession(null);
        setUser(null);
        setLoading(false);
        setOnboardingComplete(null);
      }
    };

    void initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (nextSession?.user) {
        void fetchProfile(nextSession.user.id);
      } else {
        setOnboardingComplete(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (!user?.id) return;
    await fetchProfile(user.id);
  };

  const signOut = async () => {
    // Clear local state synchronously to avoid redirect loops while Supabase completes sign-out.
    setSession(null);
    setUser(null);
    setOnboardingComplete(null);
    setLoading(false);
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  };

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      onboardingComplete,
      refreshProfile,
      signOut,
    }),
    [session, user, loading, onboardingComplete]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
