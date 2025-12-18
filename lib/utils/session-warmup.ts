/**
 * Session Warm-up Utility
 * 
 * Provides non-blocking session/network warm-up on app focus to prevent
 * slow mutations after tab blur/focus cycles.
 * 
 * Per engineering guidelines: Platform-agnostic logic with browser API adapters
 */

import { Platform, AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';

let lastWarmupAt: number = 0;
const WARMUP_THROTTLE_MS = 30 * 1000; // 30 seconds

/**
 * Performs a lightweight session warm-up (fire-and-forget)
 * - Calls getSession() once (non-blocking)
 * - Optionally performs a lightweight query to warm the connection
 * 
 * This should be called on window focus (web) or AppState active (native)
 * to ensure session/network is ready before user interactions.
 */
export function warmupSession(): void {
  const now = Date.now();
  
  // Throttle: only warm up if > 30s since last warm-up
  if (now - lastWarmupAt < WARMUP_THROTTLE_MS) {
    return;
  }
  
  lastWarmupAt = now;
  
  // Fire-and-forget: do not await, do not block UI
  (async () => {
    try {
      // Warm up session (non-blocking)
      // This ensures the session is refreshed if needed, so mutations don't wait
      supabase.auth.getSession().then(({ data: { session } }) => {
        // If user is authenticated, optionally warm up connection with lightweight query
        // This helps ensure the network connection is active
        if (session) {
          supabase
            .from('profiles')
            .select('user_id')
            .limit(0) // Lightweight query that returns no data
            .catch(() => {
              // Silently ignore errors - this is just a warm-up
            });
        }
      }).catch(() => {
        // Silently ignore errors - this is just a warm-up
      });
    } catch (error) {
      // Silently ignore errors - warm-up failures shouldn't affect the app
    }
  })();
}

/**
 * Sets up focus warm-up listeners
 * - Web: listens to window focus events
 * - Native: listens to AppState 'active' events
 * 
 * Returns cleanup function to remove listeners
 */
export function setupFocusWarmup(): () => void {
  if (Platform.OS === 'web') {
    // Web: listen to window focus
    const handleFocus = () => {
      warmupSession();
    };
    
    window.addEventListener('focus', handleFocus);
    
    // Also warm up immediately if already focused
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      warmupSession();
    }
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  } else {
    // Native: listen to AppState 'active'
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        warmupSession();
      }
    });
    
    // Also warm up immediately if already active
    if (AppState.currentState === 'active') {
      warmupSession();
    }
    
    return () => {
      subscription.remove();
    };
  }
}

