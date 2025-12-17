/**
 * Custom hook for managing entry details visibility preference
 * 
 * Handles loading, saving, and animating the showEntryDetails preference
 * using platform-appropriate storage (localStorage for web, SecureStore for native).
 */

import { useState, useEffect, useRef } from 'react';
import { Platform, Animated } from 'react-native';
import * as SecureStore from 'expo-secure-store';

interface UseEntryDetailsPreferenceReturn {
  /** Whether entry details should be shown */
  showEntryDetails: boolean;
  /** Setter for showEntryDetails */
  setShowEntryDetails: (value: boolean) => void;
  /** Animation value for the toggle (0-1) */
  toggleAnimation: Animated.Value;
  /** Whether the preference is still loading from storage */
  loading: boolean;
}

const STORAGE_KEY = 'showEntryDetails';
const DEFAULT_VALUE = true;
const ANIMATION_DURATION = 200;

/**
 * Hook for managing entry details visibility preference with persistence
 * 
 * @returns Entry details state, setter, animation value, and loading state
 */
export function useEntryDetailsPreference(): UseEntryDetailsPreferenceReturn {
  const [showEntryDetails, setShowEntryDetails] = useState<boolean>(DEFAULT_VALUE);
  const [loading, setLoading] = useState<boolean>(true);
  const toggleAnimation = useRef(new Animated.Value(DEFAULT_VALUE ? 1 : 0)).current;

  // Load preference from storage on mount
  useEffect(() => {
    const loadPreference = async () => {
      try {
        let storedValue: string | null = null;
        
        if (Platform.OS === 'web') {
          storedValue = localStorage.getItem(STORAGE_KEY);
        } else {
          storedValue = await SecureStore.getItemAsync(STORAGE_KEY);
        }

        if (storedValue !== null) {
          const value = storedValue === 'true';
          setShowEntryDetails(value);
          toggleAnimation.setValue(value ? 1 : 0);
        }
      } catch (error) {
        // Silently ignore errors - use default value
      } finally {
        setLoading(false);
      }
    };

    loadPreference();
  }, []);

  // Save preference when showEntryDetails changes (but not during initial load)
  useEffect(() => {
    if (!loading) {
      const savePreference = async () => {
        try {
          if (Platform.OS === 'web') {
            localStorage.setItem(STORAGE_KEY, showEntryDetails.toString());
          } else {
            await SecureStore.setItemAsync(STORAGE_KEY, showEntryDetails.toString());
          }
        } catch (error) {
          // Silently ignore errors - preference just won't persist
        }
      };

      savePreference();
    }
  }, [showEntryDetails, loading]);

  // Animate toggle when showEntryDetails changes (but not during initial load)
  useEffect(() => {
    if (!loading) {
      Animated.timing(toggleAnimation, {
        toValue: showEntryDetails ? 1 : 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: false,
      }).start();
    }
    // toggleAnimation is a ref and doesn't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEntryDetails, loading]);

  return {
    showEntryDetails,
    setShowEntryDetails,
    toggleAnimation,
    loading,
  };
}

