import { isLanguageSupported, setLanguage } from '@/i18n';
import { getPersistentCache, setPersistentCache } from '@/lib/persistentCache';
import { prefetchUserConfig } from '@/lib/prefetch-user-config';
import { queryClient } from '@/lib/query-client';
import { ensureProfileExists } from '@/lib/services/profileService';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

const PROFILE_MAX_AGE_MS = 24 * 60 * 60 * 1000 * 180; // 24 hours x 180
const PROFILE_TIMEOUT_MS = 7000; // 7 second timeout for profile fetch

// Profile cache key per user
const profileCacheKey = (userId: string) => `profile:${userId}`;

// DEV-only: Track timeout occurrences
let profileTimeoutCount = 0;

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: any | null;
  loading: boolean;
  retrying: boolean;
  isAdmin: boolean;
  onboardingComplete: boolean;
  isPasswordRecovery: () => boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfileState: (profile: any | null) => void;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  retrying: false,
  isAdmin: false,
  onboardingComplete: false,
  isPasswordRecovery: () => false,
  signOut: async () => {},
  refreshProfile: async () => {},
  updateProfileState: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const profileFetchRetryCount = useRef(0);
  const profileRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileRef = useRef<any | null>(null); // Ref to track profile for closures
  const userRef = useRef<User | null>(null); // Ref to track user for closures
  const isPasswordRecoveryRef = useRef(false); // Track if we're in password recovery mode
  const mountedRef = useRef(true);

  // Update refs whenever state changes
  useEffect(() => {
    profileRef.current = profile;
    userRef.current = user;
  }, [profile, user]);

  const fetchProfile = async (userId: string, isInitialLoad = false) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    try {
      // Add cancellable timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          if (process.env.NODE_ENV !== 'production') {
            profileTimeoutCount += 1;
            console.warn(`[AuthContext] Profile fetch timeout #${profileTimeoutCount} for user ${userId}`);
          }
          reject(new Error('Profile fetch timeout'));
        }, PROFILE_TIMEOUT_MS);
      });

      // Query profiles table using user_id column (confirmed: profiles table uses user_id, not id)
      // RLS policy: USING (auth.uid() = user_id) ensures users can only read their own profile
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error) {
        // If profile doesn't exist (404/406), create it with onboarding_complete = false
        if (error.code === 'PGRST116' || error.message.includes('No rows')) {
          // Profile doesn't exist, create it
          const newProfile = await ensureProfileExists(userId);
          if (newProfile) {
            setProfile(newProfile);
            saveProfileSnapshot(userId, newProfile);
            profileFetchRetryCount.current = 0;
            setRetrying(false);
            setLoading(false);
          } else {
            // Failed to create profile
            setProfile(null);
            setRetrying(false);
            setLoading(false);
          }
        } else {
          // Don't clear profile immediately on error - keep last known profile if user is still logged in
          // Only clear if this is the initial load
          if (isInitialLoad && profileFetchRetryCount.current === 0) {
            setProfile(null);
          }
          // Retry with exponential backoff (max 3 retries)
          if (profileFetchRetryCount.current < 3 && userRef.current) {
            profileFetchRetryCount.current += 1;
            // Only show retrying state if we had a profile before (reconnecting scenario)
            // On initial load, keep loading state instead
            if (profileRef.current) {
              setRetrying(true);
            }
            const retryDelay = Math.min(500 * Math.pow(2, profileFetchRetryCount.current - 1), 2000);
            profileRetryTimeoutRef.current = setTimeout(() => {
              fetchProfile(userId, false);
            }, retryDelay);
          } else {
            setRetrying(false);
            setLoading(false);
          }
        }
      } else {
        // DEV-only sanity check: verify returned profile belongs to the requesting user
        if (process.env.NODE_ENV !== 'production' && data && (data.user_id ?? data.id) !== userId) {
          console.warn(
            `[AuthContext] Profile fetch returned profile for different user! ` +
            `Requested: ${userId}, Got: ${data.user_id ?? data.id}`
          );
        }
        
        // Check if user is active (treat null as inactive for safety)
        if (data && (data.is_active === false || data.is_active === null)) {
          // User account is inactive, sign them out
          setProfile(null);
          setRetrying(false);
          setLoading(false);
          // Clear state and sign out from Supabase
          setSession(null);
          setUser(null);
          await supabase.auth.signOut();
          return;
        }
        
        setProfile(data);
        saveProfileSnapshot(userId, data);
        profileFetchRetryCount.current = 0; // Reset retry count on success
        setRetrying(false);
        setLoading(false);
        
        // Apply user's language preference from profile
        if (data?.language_preference && isLanguageSupported(data.language_preference)) {
          setLanguage(data.language_preference);
        }
      
      }
    } catch (error: any) {
      if (error.message === 'Profile fetch timeout') {
        // Profile fetch timed out
      }
      // Don't clear profile on timeout - keep last known profile if user is still logged in
      // Only clear if this is the initial load
      if (isInitialLoad && profileFetchRetryCount.current === 0) {
        setProfile(null);
      }
      // Retry with exponential backoff (max 3 retries)
      if (profileFetchRetryCount.current < 3 && userRef.current) {
        profileFetchRetryCount.current += 1;
        // Only show retrying state if we had a profile before (reconnecting scenario)
        // On initial load, keep loading state instead
        if (profileRef.current) {
          setRetrying(true);
        }
            const retryDelay = Math.min(500 * Math.pow(2, profileFetchRetryCount.current - 1), 2000);
            profileRetryTimeoutRef.current = setTimeout(() => {
          fetchProfile(userId, false);
        }, retryDelay);
      } else {
        setRetrying(false);
        setLoading(false);
      }
    } finally {
      // Always clear timeout to prevent fixed-duration behavior
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return;
    
      setSession(session);
      setUser(session?.user ?? null);
  
      if (session?.user) {
        // 1) Hydrate from persistent snapshot (if for same user)
        const snapshot = loadProfileSnapshot(session.user.id);
        if (snapshot && snapshot.user_id === session.user.id) {
          setProfile(snapshot);
        }
  
        // 2) Auth state is now known; stop global loading here
        setLoading(false);
  
        // 3) Prefetch userConfig immediately (for instant availability in Home/Settings)
        prefetchUserConfig(queryClient, session.user.id).catch((err) => {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[AuthProvider] Failed to prefetch userConfig:', err);
          }
        });
  
        // 4) Load profile from Supabase in the background – do NOT block global loading
        fetchProfile(session.user.id, true);
      } else {
        // No session: clear profile and stop loading
        setProfile(null);
        setLoading(false);
      }
    }).catch((error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[AuthProvider] Error getting initial session:', error);
      }
      if (mountedRef.current) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });
    

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;
      
      // Handle password recovery event
      if (event === 'PASSWORD_RECOVERY') {
        isPasswordRecoveryRef.current = true;
        // Set session storage flag for web
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          sessionStorage.setItem('password_recovery_mode', 'true');
        }
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id, true);
        } else {
          setLoading(false);
        }
        return;
      }
      
      // Clear password recovery flag on sign out or password update
      if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Check if password was updated by checking if recovery mode should be cleared
        const stillInRecovery = Platform.OS === 'web' && typeof window !== 'undefined' && 
          sessionStorage.getItem('password_recovery_mode') === 'true';
        if (!stillInRecovery) {
          isPasswordRecoveryRef.current = false;
        }
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          sessionStorage.removeItem('password_recovery_mode');
        }
      }
      
      // Don't refetch profile on token refresh if we already have one
      // Only refetch on actual sign in/out events
      if (event === 'TOKEN_REFRESHED' && profileRef.current && session?.user) {
        setSession(session);
        setUser(session?.user ?? null);
        return;
      }
      
      // Handle INITIAL_SESSION - this fires after getSession() completes
      // The session should already be set by getSession(), but we'll set it again to be safe
      // and ensure loading state is correct
      if (event === 'INITIAL_SESSION') {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session?.user) {
          setProfile(null);
          setLoading(false);
        }
        // If we have a user, fetchProfile was already called in getSession() handler
        // Don't call it again here to avoid duplicate calls
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Reset retry count on new session
        profileFetchRetryCount.current = 0;
        // Prefetch userConfig immediately (for instant availability in Home/Settings)
        prefetchUserConfig(queryClient, session.user.id).catch((err) => {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[AuthProvider] Failed to prefetch userConfig:', err);
          }
        });
        await fetchProfile(session.user.id, true);
      } else {
        setProfile(null);
        setRetrying(false);
        setLoading(false);
        // Clear any pending retries
        if (profileRetryTimeoutRef.current) {
          clearTimeout(profileRetryTimeoutRef.current);
          profileRetryTimeoutRef.current = null;
        }
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      if (profileRetryTimeoutRef.current) {
        clearTimeout(profileRetryTimeoutRef.current);
      }
    };
  }, []);

  // Expose password recovery state via context
  const isPasswordRecovery = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return sessionStorage.getItem('password_recovery_mode') === 'true' || isPasswordRecoveryRef.current;
    }
    return isPasswordRecoveryRef.current;
  };

  // Periodically check if profile is missing but user is logged in, and retry fetching
  // Only run this check if profile is truly missing (not just loading)
  // IMPORTANT: Never set loading=true here - profile fetch should never block startup
  useEffect(() => {
    if (!user || profile || loading) return;

    // If user is logged in but profile is null, wait a bit then retry
    // Use a longer interval to avoid excessive checks
    const checkInterval = setInterval(() => {
      // Use refs to get current values
      const currentUser = userRef.current;
      const currentProfile = profileRef.current;
      // Only retry if profile is still missing and we haven't exceeded retry limit
      // Also check that we're not already in a retry cycle
      if (currentUser && !currentProfile && !loading && profileFetchRetryCount.current === 0) {
        // Only show retrying if we previously had a profile (reconnection scenario)
        // Never set loading=true - profile fetch is background operation
        if (profileRef.current) {
          setRetrying(true);
        }
        // Fetch in background without blocking
        fetchProfile(currentUser.id, false);
      }
    }, 60000); // Check every 60 seconds (reduced frequency)

    return () => clearInterval(checkInterval);
  }, [user, profile, loading]);

  const signOut = async () => {
    try {
      // Clear state first to prevent UI flicker
      setSession(null);
      setUser(null);
      setProfile(null);
      setRetrying(false);
      setLoading(true); // Set loading while signing out
      
      // Sign out from Supabase - this should clear the session
      const { error } = await supabase.auth.signOut();
      
      // Verify session is actually cleared
      const { data: { session: verifySession } } = await supabase.auth.getSession();
      if (verifySession) {
        // Session still exists, force clear it
        // Try signing out again
        await supabase.auth.signOut();
        // Clear any stored session data manually
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          // Clear Supabase session storage
          const keys = Object.keys(localStorage);
          keys.forEach(key => {
            if (key.includes('supabase') || key.includes('sb-')) {
              localStorage.removeItem(key);
            }
          });
        }
      }
      
      if (error) {
        console.error('Sign out error:', error);
        // Even if there's an error, we've already cleared local state
      }

      // Ensure state is cleared
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
    } catch (error) {
      console.error('Sign out exception:', error);
      // Even if there's an error, clear local state
      setSession(null);
      setUser(null);
      setProfile(null);
      setRetrying(false);
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      profileFetchRetryCount.current = 0;
      await fetchProfile(user.id, false);
    }
  };

  // Calculate isAdmin from profile
  const isAdmin = profile?.is_admin === true;
  
  // Calculate onboardingComplete from profile
  const onboardingComplete = profile?.onboarding_complete === true;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        retrying,
        isAdmin,
        onboardingComplete,
        isPasswordRecovery,
        signOut,
        refreshProfile,
        updateProfileState: (profileData) => {
          setProfile(profileData);
          if (user?.id && profileData) {
            saveProfileSnapshot(user.id, profileData);
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

function loadProfileSnapshot(userId: string) {
  return getPersistentCache<any>(profileCacheKey(userId), PROFILE_MAX_AGE_MS);
}

function saveProfileSnapshot(userId: string, profile: any) {
  setPersistentCache(profileCacheKey(userId), profile);
}
