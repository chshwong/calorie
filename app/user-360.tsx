import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { BlockingBrandedLoader } from '@/components/system/BlockingBrandedLoader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { ageFromDob } from '@/utils/calculations';
import { supabase } from '@/lib/supabase';
import {
  getButtonAccessibilityProps,
  getInputAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

type UserProfile = {
  user_id: string;
  first_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  height_cm: number | null;
  weight_lb: number | null;
  height_unit: string | null;
  weight_unit: string | null;
  devnote?: string | null;
  is_active: boolean | null;
};

type SearchResult = {
  user_id: string;
  first_name: string | null;
  email?: string | null;
};

type AllUsersRow = {
  user_id: string;
  first_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  height_cm: number | null;
  weight_lb: number | null;
  height_unit: string | null;
  weight_unit: string | null;
  devnote: string | null;
  email: string | null;
  is_active: boolean | null;
};

type FoodLogEntryRow = {
  id: string;
  user_id: string;
  entry_date: string;
  eaten_at: string | null;
  meal_type: string;
  item_name: string;
  quantity: number;
  unit: string;
  calories_kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  saturated_fat_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  notes: string | null;
  food_id: string | null;
  serving_id: string | null;
  created_at: string;
  updated_at: string;
};

type CustomFoodRow = {
  id: string;
  name: string | null;
  brand: string | null;
  serving_size: number | null;
  serving_unit: string | null;
  calories_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  saturated_fat_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  owner_user_id: string | null;
  order_index: number | null;
  is_custom: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type BundleRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type BundleItemRow = {
  id: string;
  bundle_id: string;
  food_id: string | null;
  item_name: string | null;
  serving_id: string | null;
  quantity: number;
  unit: string;
  order_index: number;
  user_id?: string | null; // User ID from associated bundle
};

export default function User360Screen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { profile: currentProfile, user: currentUser, loading: authLoading, isAdmin } = useAuth();
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [allUsers, setAllUsers] = useState<AllUsersRow[]>([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);
  const [foodLogEntries, setFoodLogEntries] = useState<FoodLogEntryRow[]>([]);
  const [loadingFoodLogEntries, setLoadingFoodLogEntries] = useState(false);
  const [customFoods, setCustomFoods] = useState<CustomFoodRow[]>([]);
  const [loadingCustomFoods, setLoadingCustomFoods] = useState(false);
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [loadingBundles, setLoadingBundles] = useState(false);
  const [bundleItems, setBundleItems] = useState<BundleItemRow[]>([]);
  const [loadingBundleItems, setLoadingBundleItems] = useState(false);

  // Format date for grid display (YYYY-MM-DD format)
  const formatDateForGrid = (dob: string | null | undefined): string => {
    if (!dob) return '-';
    return dob; // Already in YYYY-MM-DD format from database
  };

  // Fetch all users from database using admin function (only if admin)
  const fetchAllUsers = useCallback(async () => {
    // Only fetch all users if user is admin
    if (!isAdmin) {
      setAllUsers([]);
      setLoadingAllUsers(false);
      return;
    }

    setLoadingAllUsers(true);
    try {
      // Use the database function that bypasses RLS
      const { data: profilesData, error: profilesError } = await supabase
        .rpc('get_all_user_profiles');

      if (profilesError) {
        console.error('Error fetching all users:', profilesError);
        // If the function doesn't exist, provide helpful error message
        if (profilesError.code === 'PGRST202' || profilesError.message?.includes('Could not find the function')) {
          console.error('Database function get_all_user_profiles() not found. Please run supabase-admin-view-all-profiles.sql in your Supabase SQL editor.');
        }
        setAllUsers([]);
        setLoadingAllUsers(false);
        return;
      }

      // Map profiles to AllUsersRow, including email from currentUser if available
      const usersWithEmail: AllUsersRow[] = (profilesData || []).map((profile: any) => ({
        user_id: profile.user_id,
        first_name: profile.first_name,
        date_of_birth: profile.date_of_birth,
        gender: profile.gender,
        height_cm: profile.height_cm,
        weight_lb: profile.weight_lb,
        height_unit: profile.height_unit,
        weight_unit: profile.weight_unit,
        devnote: profile.devnote || null,
        email: profile.user_id === currentUser?.id ? (currentUser?.email || null) : null,
        is_active: profile.is_active ?? null,
      }));

      setAllUsers(usersWithEmail);
    } catch (error) {
      console.error('Error fetching all users:', error);
      setAllUsers([]);
    } finally {
      setLoadingAllUsers(false);
    }
  }, [currentUser, isAdmin]);

  // Fetch food log entries for a user
  const fetchFoodLogEntries = useCallback(async (userId: string) => {
    if (!isAdmin) {
      setFoodLogEntries([]);
      setLoadingFoodLogEntries(false);
      return;
    }

    setLoadingFoodLogEntries(true);
    const isCurrentUser = userId === currentUser?.id;
    
    try {
      let data: any = null;
      let error: any = null;
      
      // Try RPC function first for admin access
      const rpcResult = await supabase
        .rpc('admin_get_user_calorie_entries', { p_user_id: userId });
      
      error = rpcResult.error;
      
      // If RPC fails and this is the current user, fallback to direct query (RLS allows own data)
      if (error && (error.code === 'PGRST202' || error.message?.includes('function') || error.message?.includes('not found'))) {
        if (isCurrentUser) {
          const directResult = await supabase
            .from('calorie_entries')
            .select('*')
            .eq('user_id', userId)
            .order('entry_date', { ascending: false })
            .order('created_at', { ascending: false });
          data = directResult.data;
          error = directResult.error;
        } else {
          console.error('Database function admin_get_user_calorie_entries() not found. Please run supabase-admin-fetch-user-data.sql in your Supabase SQL editor.');
        }
      } else {
        data = rpcResult.data;
      }

      if (error) {
        console.error('Error fetching food log entries for user', userId, ':', error);
        setFoodLogEntries([]);
      } else {
        setFoodLogEntries((data || []) as FoodLogEntryRow[]);
      }
    } catch (error) {
      console.error('Exception fetching food log entries for user', userId, ':', error);
      setFoodLogEntries([]);
    } finally {
      setLoadingFoodLogEntries(false);
    }
  }, [isAdmin, currentUser]);

// Fetch custom foods for a user
const fetchCustomFoods = useCallback(async (userId: string) => {
  if (!isAdmin) {
    setCustomFoods([]);
    setLoadingCustomFoods(false);
    return;
  }

  setLoadingCustomFoods(true);
  const isCurrentUser = userId === currentUser?.id;
  
  try {
    let data: any = null;
    let error: any = null;
    
    // Try RPC function first for admin access
    const rpcResult = await supabase
      .rpc('admin_get_user_custom_foods', { p_user_id: userId });
    
    error = rpcResult.error;
    
    // If RPC fails and this is the current user, fallback to direct query (RLS allows own data)
    if (error && (error.code === 'PGRST202' || error.message?.includes('function') || error.message?.includes('not found'))) {
      if (isCurrentUser) {
        const directResult = await supabase
          .from('food_master')
          .select('*')
          .eq('owner_user_id', userId)
          .eq('is_custom', true)
          .order('name', { ascending: true });
        data = directResult.data;
        error = directResult.error;
      } else {
        console.error('Database function admin_get_user_custom_foods() not found. Please run supabase-admin-fetch-user-data.sql in your Supabase SQL editor.');
      }
    } else {
      data = rpcResult.data;
    }

    if (error) {
      console.error('Error fetching custom foods for user', userId, ':', error);
      setCustomFoods([]);
    } else {
      setCustomFoods((data || []) as CustomFoodRow[]);
    }
  } catch (error) {
    console.error('Exception fetching custom foods for user', userId, ':', error);
    setCustomFoods([]);
  } finally {
    setLoadingCustomFoods(false);
  }
  }, [isAdmin, currentUser]);

  // Fetch bundle items for given bundle IDs
  const fetchBundleItems = useCallback(async (bundleIds: string[], bundlesData?: BundleRow[]) => {
    if (!isAdmin || !bundleIds || bundleIds.length === 0) {
      setBundleItems([]);
      setLoadingBundleItems(false);
      return;
    }

    setLoadingBundleItems(true);
    try {
      let data: any = null;
      let error: any = null;
      
      // Try RPC function first
      const rpcResult = await supabase
        .rpc('admin_get_bundle_items', { p_bundle_ids: bundleIds });
      
      error = rpcResult.error;
      data = rpcResult.data;
      
      // If RPC fails, fallback to direct query if we have bundle data
      if (error) {
        // Check if all bundles belong to current user (RLS allows own data)
        const isCurrentUserBundles = bundlesData && bundlesData.length > 0 && bundlesData.every(b => b.user_id === currentUser?.id);
        if (isCurrentUserBundles) {
          const directResult = await supabase
            .from('bundle_items')
            .select('*')
            .in('bundle_id', bundleIds)
            .order('order_index', { ascending: true });
          if (!directResult.error) {
            data = directResult.data;
            error = null; // Clear error if direct query succeeds
          } else {
            console.error('Direct query also failed:', directResult.error);
          }
        } else if (error.code === 'PGRST202' || error.message?.includes('function') || error.message?.includes('not found')) {
          console.error('Database function admin_get_bundle_items() not found. Please run supabase-admin-fetch-user-data.sql in your Supabase SQL editor.');
        }
      }

      if (error) {
        console.error('Error fetching bundle items for bundles', bundleIds, ':', error);
        setBundleItems([]);
      } else {
        // Create a map of bundle_id to user_id
        const bundleUserMap = new Map<string, string>();
        if (bundlesData) {
          bundlesData.forEach(bundle => {
            bundleUserMap.set(bundle.id, bundle.user_id);
          });
        }

        // Add user_id to each bundle item
        const itemsWithUserId: BundleItemRow[] = (data || []).map((item: any) => ({
          ...item,
          user_id: bundleUserMap.get(item.bundle_id) || null,
        }));
        
        setBundleItems(itemsWithUserId);
      }
    } catch (error) {
      console.error('Exception fetching bundle items:', error);
      setBundleItems([]);
    } finally {
      setLoadingBundleItems(false);
    }
  }, [isAdmin, currentUser]);

  // Fetch bundles for a user
  const fetchBundles = useCallback(async (userId: string) => {
    if (!isAdmin) {
      setBundles([]);
      setLoadingBundles(false);
      return;
    }

    setLoadingBundles(true);
    const isCurrentUser = userId === currentUser?.id;
    
    try {
      let data: any = null;
      let error: any = null;
      
      // Try RPC function first for admin access
      const rpcResult = await supabase
        .rpc('admin_get_user_bundles', { p_user_id: userId });
      
      error = rpcResult.error;
      data = rpcResult.data;
      
      // If RPC fails and this is the current user, fallback to direct query (RLS allows own data)
      if (error && isCurrentUser) {
        const directResult = await supabase
          .from('bundles')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (!directResult.error) {
          data = directResult.data;
          error = null; // Clear error if direct query succeeds
        } else {
          console.error('Direct query also failed:', directResult.error);
        }
      } else if (error && (error.code === 'PGRST202' || error.message?.includes('function') || error.message?.includes('not found'))) {
        console.error('Database function admin_get_user_bundles() not found. Please run supabase-admin-fetch-user-data.sql in your Supabase SQL editor.');
      }

      if (error) {
        console.error('Error fetching bundles for user', userId, ':', error);
        setBundles([]);
        setBundleItems([]);
        setLoadingBundleItems(false);
      } else {
        setBundles((data || []) as BundleRow[]);
        
        // Fetch bundle items for these bundles
        if (data && data.length > 0) {
          const bundleIds = data.map((b: BundleRow) => b.id);
          fetchBundleItems(bundleIds, data);
        } else {
          setBundleItems([]);
          setLoadingBundleItems(false);
        }
      }
    } catch (error) {
      console.error('Exception fetching bundles for user', userId, ':', error);
      setBundles([]);
      setBundleItems([]);
      setLoadingBundleItems(false);
    } finally {
      setLoadingBundles(false);
    }
  }, [isAdmin, fetchBundleItems, currentUser]);

  // Load all users only once on mount, not on every focus
  useEffect(() => {
    if (!authLoading && isAdmin && allUsers.length === 0 && !loadingAllUsers) {
      fetchAllUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAdmin]); // Only depend on authLoading and isAdmin, not fetchAllUsers

  // Load current user's profile by default only if not already selected
  useEffect(() => {
    if (!authLoading && currentProfile && currentUser && !selectedProfile) {
      setSelectedProfile(currentProfile as UserProfile);
      setSelectedUserEmail(currentUser.email || null);
      setProfileLoading(false);
      // Fetch associated data for current user only if grids are empty
      if (isAdmin) {
        if (foodLogEntries.length === 0 && !loadingFoodLogEntries) {
          fetchFoodLogEntries(currentUser.id);
        }
        if (customFoods.length === 0 && !loadingCustomFoods) {
          fetchCustomFoods(currentUser.id);
        }
        if (bundles.length === 0 && !loadingBundles) {
          fetchBundles(currentUser.id);
        }
      }
    } else if (!authLoading && !currentProfile && !selectedProfile) {
      setProfileLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, currentProfile, currentUser, isAdmin, selectedProfile]); // Only depend on these, not the fetch functions

  // Search for users by first_name or user_id
  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearching(true);
    try {
      const trimmedQuery = query.trim();
      
      // Check if query looks like a UUID (user_id)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedQuery);
      
      let profilesQuery;
      
      if (isUUID) {
        // Search by exact user_id
        profilesQuery = supabase
          .from('profiles')
          .select('user_id, first_name')
          .eq('user_id', trimmedQuery)
          .limit(10);
      } else {
        // Search by first_name (case-insensitive partial match)
        profilesQuery = supabase
          .from('profiles')
          .select('user_id, first_name')
          .ilike('first_name', `%${trimmedQuery}%`)
          .limit(10);
      }

      const { data, error } = await profilesQuery;

      if (error) {
        console.error('Error searching users:', error);
        setSearchResults([]);
        setShowSearchResults(false);
      } else {
        const results: SearchResult[] = (data || []).map((profile: any) => ({
          user_id: profile.user_id,
          first_name: profile.first_name,
          email: null, // We'll try to fetch this when selected
        }));
        
        setSearchResults(results);
        setShowSearchResults(results.length > 0);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  // Load a user's profile by user_id
  const loadUserProfile = useCallback(async (userId: string) => {
    // Clear all existing data immediately when selecting a new user
    setProfileLoading(true);
    setShowSearchResults(false);
    setSearchQuery('');
    setSelectedProfile(null);
    setSelectedUserEmail(null);
    setFoodLogEntries([]);
    setCustomFoods([]);
    setBundles([]);
    setBundleItems([]);

    try {
      // First, try to get profile from already-loaded allUsers list
      let profileData: any = null;
      let userEmail: string | null = null;
      const foundUser = allUsers.find(u => u.user_id === userId);
      
      // If found in allUsers, convert AllUsersRow to UserProfile format
      if (foundUser) {
        profileData = {
          user_id: foundUser.user_id,
          first_name: foundUser.first_name,
          date_of_birth: foundUser.date_of_birth,
          gender: foundUser.gender,
          height_cm: foundUser.height_cm,
          weight_lb: foundUser.weight_lb,
          height_unit: foundUser.height_unit,
          weight_unit: foundUser.weight_unit,
          devnote: foundUser.devnote,
          is_active: foundUser.is_active,
        };
        userEmail = foundUser.email || null;
      }
      
      // If not found in allUsers, try RPC function for admin
      if (!profileData && isAdmin) {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('admin_get_user_profile', { p_user_id: userId });
        
        if (!rpcError && rpcData && rpcData.length > 0) {
          profileData = rpcData[0];
          // RPC function doesn't return email, so leave it null
        }
      }
      
      // If still not found, try direct query (will work for current user due to RLS)
      if (!profileData) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (error) {
          console.error('Error loading profile:', error);
          setSelectedProfile(null);
          setSelectedUserEmail(null);
          setFoodLogEntries([]);
          setCustomFoods([]);
          setBundles([]);
          setBundleItems([]);
          setProfileLoading(false);
          return;
        }
        profileData = data;
      }

      if (profileData) {
        setSelectedProfile(profileData as UserProfile);
        
        // Set email - prioritize from allUsers, then currentUser.email if it's the current user
        if (userEmail) {
          setSelectedUserEmail(userEmail);
        } else if (userId === currentUser?.id && currentUser?.email) {
          setSelectedUserEmail(currentUser.email);
        } else {
          setSelectedUserEmail(null);
        }
        
        // Fetch associated data for the selected user
        if (isAdmin) {
          fetchFoodLogEntries(userId);
          fetchCustomFoods(userId);
          fetchBundles(userId);
        }
      } else {
        setSelectedProfile(null);
        setSelectedUserEmail(null);
        setFoodLogEntries([]);
        setCustomFoods([]);
        setBundles([]);
        setBundleItems([]);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setSelectedProfile(null);
      setSelectedUserEmail(null);
      setFoodLogEntries([]);
      setCustomFoods([]);
      setBundles([]);
      setBundleItems([]);
    } finally {
      setProfileLoading(false);
    }
  }, [currentUser, isAdmin, fetchFoodLogEntries, fetchCustomFoods, fetchBundles, allUsers]);

  // Handle selecting a user from search results
  const handleSelectUser = useCallback((userId: string) => {
    loadUserProfile(userId);
  }, [loadUserProfile]);

  // Format date of birth for display
  const formatDateOfBirth = (dob: string | null | undefined): string => {
    if (!dob) return 'Not set';
    try {
      const date = new Date(dob + 'T00:00:00');
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dob;
    }
  };

  // Format gender for display
  const formatGender = (gender: string | null | undefined): string => {
    if (!gender) return 'Not set';
    const genderMap: { [key: string]: string } = {
      'male': 'Male',
      'female': 'Female',
      'not_telling': 'Prefer not to say',
    };
    return genderMap[gender] || gender;
  };

  // Format height for display
  const formatHeight = (heightCm: number | null | undefined, heightUnit: string | null | undefined): string => {
    if (!heightCm) return 'Not set';
    if (heightUnit === 'ft') {
      const totalInches = heightCm / 2.54;
      const feet = Math.floor(totalInches / 12);
      const inches = Math.round(totalInches % 12);
      return `${feet}'${inches}" (${heightCm.toFixed(1)} cm)`;
    }
    return `${heightCm.toFixed(1)} cm`;
  };

  // Format weight for display
  const formatWeight = (weightLb: number | null | undefined, weightUnit: string | null | undefined): string => {
    if (!weightLb) return 'Not set';
    if (weightUnit === 'kg') {
      const kg = (weightLb / 2.20462).toFixed(1);
      return `${kg} kg (${weightLb.toFixed(1)} lbs)`;
    }
    return `${weightLb.toFixed(1)} lbs`;
  };

  // Check admin access on focus
  useFocusEffect(
    useCallback(() => {
      if (!authLoading && !isAdmin) {
        Alert.alert('Access Denied', 'You do not have permission to access this page.');
        router.back();
      }
    }, [isAdmin, authLoading, router])
  );

  // Calculate age from date of birth
  const age = selectedProfile?.date_of_birth ? ageFromDob(selectedProfile.date_of_birth) : null;

  // Don't render content if not admin
  if (authLoading) {
    return (
      <View style={{ flex: 1 }}>
        <BlockingBrandedLoader enabled={true} timeoutMs={5000} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText style={[styles.emptyText, { color: '#ff0000', fontWeight: 'bold' }]}>
            Access Denied
          </ThemedText>
          <ThemedText style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            You do not have permission to access this page.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (profileLoading) {
    return (
      <View style={{ flex: 1 }}>
        <BlockingBrandedLoader enabled={true} timeoutMs={5000} />
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity
          style={[
            styles.backButton,
            getMinTouchTargetStyle(),
            { ...(Platform.OS === 'web' ? getFocusStyle(colors.tint) : {}) },
          ]}
          onPress={() => router.back()}
          activeOpacity={0.6}
          {...getButtonAccessibilityProps(
            'Go back',
            'Double tap to go back to the previous screen'
          )}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} decorative={true} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          User 360
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      {/* Scrollable Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        style={styles.scrollView}
      >
        {/* All Users Grid - Only show if admin */}
        {isAdmin && (
        <View style={styles.gridContainer}>
        <View style={styles.gridHeader}>
          <ThemedText style={[styles.gridTitle, { color: colors.text }]}>
            User Grid ({allUsers.length} {allUsers.length === 1 ? 'row' : 'rows'})
          </ThemedText>
        </View>
        <View style={styles.tableWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            style={styles.tableHorizontalScroll}
          >
            <View style={styles.tableContainer}>
              {/* Table Header */}
              <View style={[styles.tableHeader, { backgroundColor: colors.card, borderBottomColor: colors.separator }]}>
                <View style={[styles.headerCell, { width: 150, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>First Name</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 200, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>User ID</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 120, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Date of Birth</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 100, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Gender</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 100, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Height (cm)</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 100, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Weight (lb)</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 150, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Devnote</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 80, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Height Unit</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 80, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Weight Unit</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 200, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Email</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 100 }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Is Active</ThemedText>
                </View>
              </View>

              {/* Table Body */}
              <ScrollView
                style={styles.tableBodyScroll}
                showsVerticalScrollIndicator={true}
              >
                {loadingAllUsers ? (
                  <View style={styles.emptyContainer}>
                    <ActivityIndicator size="small" color={colors.tint} />
                    <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                      Loading users...
                    </ThemedText>
                  </View>
                ) : allUsers.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No users found
                    </ThemedText>
                  </View>
                ) : (
                  allUsers.map((user, rowIndex) => {
                    const isSelected = selectedProfile?.user_id === user.user_id;
                    return (
                      <TouchableOpacity
                        key={user.user_id || rowIndex}
                        style={[
                          styles.tableRow,
                          {
                            backgroundColor: isSelected ? colors.tint + '15' : 'transparent',
                            borderBottomColor: colors.separator,
                          }
                        ]}
                        onPress={() => handleSelectUser(user.user_id)}
                        activeOpacity={0.7}
                        {...getButtonAccessibilityProps(
                          `${user.first_name || 'User'} row`,
                          'Double tap to view this user\'s profile'
                        )}
                      >
                        <View style={[styles.tableCell, { width: 150, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {user.first_name || '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 200, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                            {user.user_id || '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 120, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {formatDateForGrid(user.date_of_birth)}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 100, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {formatGender(user.gender)}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 100, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {user.height_cm ? user.height_cm.toFixed(1) : '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 100, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {user.weight_lb ? user.weight_lb.toFixed(1) : '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 150, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={2}>
                            {user.devnote || '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 80, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {user.height_unit || '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 80, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {user.weight_unit || '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 200, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {user.email || '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 100 }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {user.is_active !== null && user.is_active !== undefined ? (user.is_active ? 'Yes' : 'No') : '-'}
                          </ThemedText>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </View>
      )}

      {/* Associated Food Log Entries Grid */}
      <View style={styles.gridContainer}>
          <View style={styles.gridHeader}>
            <ThemedText style={[styles.gridTitle, { color: colors.text }]}>
              Associated Food Log Entries ({foodLogEntries.length} {foodLogEntries.length === 1 ? 'row' : 'rows'})
            </ThemedText>
          </View>
          <View style={styles.tableWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              style={styles.tableHorizontalScroll}
            >
              <View style={styles.tableContainer}>
                {/* Table Header */}
                <View style={[styles.tableHeader, { backgroundColor: colors.card, borderBottomColor: colors.separator }]}>
                  <View style={[styles.headerCell, { width: 200, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>User ID</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 120, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Entry Date</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 100, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Meal Type</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 200, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Item Name</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 100, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Quantity</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 80, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Unit</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 100, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Calories</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 100, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Protein (g)</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 150 }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Food ID</ThemedText>
                  </View>
                </View>

                {/* Table Body */}
                <ScrollView
                  style={styles.tableBodyScroll}
                  showsVerticalScrollIndicator={true}
                >
                  {loadingFoodLogEntries ? (
                    <View style={styles.emptyContainer}>
                      <ActivityIndicator size="small" color={colors.tint} />
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Loading entries...
                      </ThemedText>
                    </View>
                  ) : foodLogEntries.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No food log entries found
                      </ThemedText>
                    </View>
                  ) : (
                    foodLogEntries
                      .filter(entry => !selectedProfile || entry.user_id === selectedProfile.user_id)
                      .map((entry, rowIndex) => (
                      <View
                        key={entry.id || rowIndex}
                        style={[
                          styles.tableRow,
                          {
                            backgroundColor: 'transparent',
                            borderBottomColor: colors.separator,
                          }
                        ]}
                      >
                        <View style={[styles.tableCell, { width: 200, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                            {entry.user_id || '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 120, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {entry.entry_date || '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 100, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {entry.meal_type || '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 200, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={2}>
                            {entry.item_name || '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 100, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {entry.quantity != null ? entry.quantity.toString() : '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 80, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {entry.unit || '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 100, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {entry.calories_kcal != null ? entry.calories_kcal.toString() : '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 100, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {entry.protein_g != null ? entry.protein_g.toString() : '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 150 }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                            {entry.food_id || '-'}
                          </ThemedText>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        </View>

      {/* Associated Custom Food Grid */}
      <View style={styles.gridContainer}>
          <View style={styles.gridHeader}>
            <ThemedText style={[styles.gridTitle, { color: colors.text }]}>
              Associated Custom Food ({customFoods.length} {customFoods.length === 1 ? 'row' : 'rows'})
            </ThemedText>
          </View>
          <View style={styles.tableWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              style={styles.tableHorizontalScroll}
            >
              <View style={styles.tableContainer}>
                {/* Table Header */}
                <View style={[styles.tableHeader, { backgroundColor: colors.card, borderBottomColor: colors.separator }]}>
                  <View style={[styles.headerCell, { width: 200, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>User ID</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 150, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Name</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 150, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Brand</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 100, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Serving Size</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 80, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Unit</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 100, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Calories</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 100, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Protein (g)</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 100, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Carbs (g)</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 100, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Fat (g)</ThemedText>
                  </View>
                  <View style={[styles.headerCell, { width: 150 }]}>
                    <ThemedText style={[styles.headerText, { color: colors.text }]}>Food ID</ThemedText>
                  </View>
                </View>

                {/* Table Body */}
                <ScrollView
                  style={styles.tableBodyScroll}
                  showsVerticalScrollIndicator={true}
                >
                  {loadingCustomFoods ? (
                    <View style={styles.emptyContainer}>
                      <ActivityIndicator size="small" color={colors.tint} />
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Loading custom foods...
                      </ThemedText>
                    </View>
                  ) : customFoods.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No custom foods found
                      </ThemedText>
                    </View>
                  ) : (
                    customFoods
                      .filter(food => !selectedProfile || food.owner_user_id === selectedProfile.user_id)
                      .map((food, rowIndex) => (
                      <View
                        key={food.id || rowIndex}
                        style={[
                          styles.tableRow,
                          {
                            backgroundColor: 'transparent',
                            borderBottomColor: colors.separator,
                          }
                        ]}
                      >
                        <View style={[styles.tableCell, { width: 200, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                            {food.owner_user_id || '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 150, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={2}>
                            {food.name || '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 150, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {food.brand || '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 100, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {food.serving_size != null ? food.serving_size.toString() : '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 80, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {food.serving_unit || '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 100, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {food.calories_kcal != null ? food.calories_kcal.toString() : '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 100, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {food.protein_g != null ? food.protein_g.toString() : '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 100, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {food.carbs_g != null ? food.carbs_g.toString() : '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 100, borderRightColor: colors.separator }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                            {food.fat_g != null ? food.fat_g.toString() : '-'}
                          </ThemedText>
                        </View>
                        <View style={[styles.tableCell, { width: 150 }]}>
                          <ThemedText style={[styles.cellText, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                            {food.id || '-'}
                          </ThemedText>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        </View>

      {/* Associated Bundles Grid */}
      <View style={styles.gridContainer}>
        <View style={styles.gridHeader}>
          <ThemedText style={[styles.gridTitle, { color: colors.text }]}>
            Associated Bundles ({bundles.length} {bundles.length === 1 ? 'row' : 'rows'})
          </ThemedText>
        </View>
        <View style={styles.tableWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            style={styles.tableHorizontalScroll}
          >
            <View style={styles.tableContainer}>
              {/* Table Header */}
              <View style={[styles.tableHeader, { backgroundColor: colors.card, borderBottomColor: colors.separator }]}>
                <View style={[styles.headerCell, { width: 200, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>User ID</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 200, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>ID</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 200, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Name</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 150, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Created At</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 150 }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Updated At</ThemedText>
                </View>
              </View>

              {/* Table Body */}
              <ScrollView
                style={styles.tableBodyScroll}
                showsVerticalScrollIndicator={true}
              >
                {loadingBundles ? (
                  <View style={styles.emptyContainer}>
                    <ActivityIndicator size="small" color={colors.tint} />
                    <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                      Loading bundles...
                    </ThemedText>
                  </View>
                ) : bundles.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No bundles found
                    </ThemedText>
                  </View>
                ) : (
                  bundles
                    .filter(bundle => !selectedProfile || bundle.user_id === selectedProfile.user_id)
                    .map((bundle, rowIndex) => (
                    <View
                      key={bundle.id || rowIndex}
                      style={[
                        styles.tableRow,
                        {
                          backgroundColor: 'transparent',
                          borderBottomColor: colors.separator,
                        }
                      ]}
                    >
                      <View style={[styles.tableCell, { width: 200, borderRightColor: colors.separator }]}>
                        <ThemedText style={[styles.cellText, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                          {bundle.user_id || '-'}
                        </ThemedText>
                      </View>
                      <View style={[styles.tableCell, { width: 200, borderRightColor: colors.separator }]}>
                        <ThemedText style={[styles.cellText, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                          {bundle.id || '-'}
                        </ThemedText>
                      </View>
                      <View style={[styles.tableCell, { width: 200, borderRightColor: colors.separator }]}>
                        <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={2}>
                          {bundle.name || '-'}
                        </ThemedText>
                      </View>
                      <View style={[styles.tableCell, { width: 150, borderRightColor: colors.separator }]}>
                        <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                          {bundle.created_at ? new Date(bundle.created_at).toLocaleDateString() : '-'}
                        </ThemedText>
                      </View>
                      <View style={[styles.tableCell, { width: 150 }]}>
                        <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                          {bundle.updated_at ? new Date(bundle.updated_at).toLocaleDateString() : '-'}
                        </ThemedText>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Associated Bundle Items Grid */}
      <View style={styles.gridContainer}>
        <View style={styles.gridHeader}>
          <ThemedText style={[styles.gridTitle, { color: colors.text }]}>
            Associated Bundle Items ({bundleItems.length} {bundleItems.length === 1 ? 'row' : 'rows'})
          </ThemedText>
        </View>
        <View style={styles.tableWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            style={styles.tableHorizontalScroll}
          >
            <View style={styles.tableContainer}>
              {/* Table Header */}
              <View style={[styles.tableHeader, { backgroundColor: colors.card, borderBottomColor: colors.separator }]}>
                <View style={[styles.headerCell, { width: 200, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>User ID</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 200, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>ID</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 200, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Bundle ID</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 200, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Food ID</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 200, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Item Name</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 150, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Serving ID</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 100, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Quantity</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 80, borderRightColor: colors.separator }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Unit</ThemedText>
                </View>
                <View style={[styles.headerCell, { width: 100 }]}>
                  <ThemedText style={[styles.headerText, { color: colors.text }]}>Order Index</ThemedText>
                </View>
              </View>

              {/* Table Body */}
              <ScrollView
                style={styles.tableBodyScroll}
                showsVerticalScrollIndicator={true}
              >
                {loadingBundleItems ? (
                  <View style={styles.emptyContainer}>
                    <ActivityIndicator size="small" color={colors.tint} />
                    <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                      Loading bundle items...
                    </ThemedText>
                  </View>
                ) : bundleItems.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No bundle items found
                    </ThemedText>
                  </View>
                ) : (
                  bundleItems
                    .filter(item => !selectedProfile || item.user_id === selectedProfile.user_id)
                    .map((item, rowIndex) => (
                    <View
                      key={item.id || rowIndex}
                      style={[
                        styles.tableRow,
                        {
                          backgroundColor: 'transparent',
                          borderBottomColor: colors.separator,
                        }
                      ]}
                    >
                      <View style={[styles.tableCell, { width: 200, borderRightColor: colors.separator }]}>
                        <ThemedText style={[styles.cellText, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                          {item.user_id || '-'}
                        </ThemedText>
                      </View>
                      <View style={[styles.tableCell, { width: 200, borderRightColor: colors.separator }]}>
                        <ThemedText style={[styles.cellText, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                          {item.id || '-'}
                        </ThemedText>
                      </View>
                      <View style={[styles.tableCell, { width: 200, borderRightColor: colors.separator }]}>
                        <ThemedText style={[styles.cellText, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                          {item.bundle_id || '-'}
                        </ThemedText>
                      </View>
                      <View style={[styles.tableCell, { width: 200, borderRightColor: colors.separator }]}>
                        <ThemedText style={[styles.cellText, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                          {item.food_id || '-'}
                        </ThemedText>
                      </View>
                      <View style={[styles.tableCell, { width: 200, borderRightColor: colors.separator }]}>
                        <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={2}>
                          {item.item_name || '-'}
                        </ThemedText>
                      </View>
                      <View style={[styles.tableCell, { width: 150, borderRightColor: colors.separator }]}>
                        <ThemedText style={[styles.cellText, { color: colors.text, fontSize: 11 }]} numberOfLines={1}>
                          {item.serving_id || '-'}
                        </ThemedText>
                      </View>
                      <View style={[styles.tableCell, { width: 100, borderRightColor: colors.separator }]}>
                        <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                          {item.quantity != null ? item.quantity.toString() : '-'}
                        </ThemedText>
                      </View>
                      <View style={[styles.tableCell, { width: 80, borderRightColor: colors.separator }]}>
                        <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                          {item.unit || '-'}
                        </ThemedText>
                      </View>
                      <View style={[styles.tableCell, { width: 100 }]}>
                        <ThemedText style={[styles.cellText, { color: colors.text }]} numberOfLines={1}>
                          {item.order_index != null ? item.order_index.toString() : '-'}
                        </ThemedText>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} decorative={true} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name or User ID"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (text.trim().length >= 2) {
                setShowSearchResults(true);
              }
            }}
            onFocus={() => {
              if (searchResults.length > 0 && searchQuery.trim()) {
                setShowSearchResults(true);
              }
            }}
            {...getInputAccessibilityProps(
              'User search',
              'Enter user name or user ID to search'
            )}
          />
          {searching && (
            <ActivityIndicator size="small" color={colors.tint} />
          )}
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowSearchResults(false);
              }}
              style={styles.clearSearchButton}
              {...getButtonAccessibilityProps(
                'Clear search',
                'Double tap to clear search'
              )}
            >
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.textSecondary} decorative={true} />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <View style={[styles.searchResultsContainer, { backgroundColor: colors.card, borderColor: colors.separator }]}>
            <ScrollView 
              style={styles.searchResultsScroll}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              {searchResults.map((result) => (
                <TouchableOpacity
                  key={result.user_id}
                  style={[
                    styles.searchResultItem,
                    { 
                      backgroundColor: 'transparent',
                      borderBottomColor: colors.separator,
                    }
                  ]}
                  onPress={() => handleSelectUser(result.user_id)}
                  activeOpacity={0.7}
                  {...getButtonAccessibilityProps(
                    `${result.first_name || 'User'} (${result.user_id.slice(0, 8)}...)`,
                    'Double tap to view this user\'s profile'
                  )}
                >
                  <View style={styles.searchResultContent}>
                    <ThemedText 
                      style={[styles.searchResultName, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {result.first_name || 'Unnamed User'}
                    </ThemedText>
                    <ThemedText 
                      style={[styles.searchResultId, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {result.user_id}
                    </ThemedText>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} decorative={true} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
      </ScrollView>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Platform.select({ web: 16, default: 16 }),
    paddingTop: Platform.select({ web: 30, default: Platform.OS === 'ios' ? 50 : 30 }),
    paddingBottom: 16,
    borderBottomWidth: 1,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'var(--background)',
      },
      default: {
        backgroundColor: 'transparent',
      },
    }),
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      },
    }),
  },
  headerTitle: {
    fontSize: Platform.select({ web: 20, default: 18 }),
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 44,
  },
  searchContainer: {
    marginHorizontal: Platform.select({ web: 16, default: 16 }),
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: Platform.select({ web: 14, default: 14 }),
    padding: 0,
  },
  clearSearchButton: {
    padding: 4,
  },
  searchResultsContainer: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 300,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
      },
    }),
  },
  searchResultsScroll: {
    maxHeight: 300,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 44,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
      },
    }),
  },
  searchResultContent: {
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },
  searchResultName: {
    fontSize: Platform.select({ web: 14, default: 14 }),
    fontWeight: '600',
    marginBottom: 2,
  },
  searchResultId: {
    fontSize: Platform.select({ web: 12, default: 12 }),
    opacity: 0.7,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Platform.select({ web: 16, default: 16 }),
    paddingBottom: Platform.select({ web: 24, default: 24 }),
  },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    marginBottom: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: Platform.select({ web: 24, default: 22 }),
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: Platform.select({ web: 14, default: 14 }),
  },
  currentUserBadge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  currentUserBadgeText: {
    fontSize: Platform.select({ web: 12, default: 12 }),
    fontWeight: '600',
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: Platform.select({ web: 18, default: 16 }),
    fontWeight: '700',
    marginBottom: 12,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  infoLabel: {
    fontSize: Platform.select({ web: 14, default: 14 }),
    fontWeight: '500',
  },
  infoValue: {
    fontSize: Platform.select({ web: 14, default: 14 }),
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  infoDivider: {
    height: 1,
    marginVertical: 4,
  },
  gridContainer: {
    marginHorizontal: Platform.select({ web: 16, default: 16 }),
    marginTop: 16,
    marginBottom: 16,
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  gridTitle: {
    fontSize: Platform.select({ web: 18, default: 16 }),
    fontWeight: '700',
  },
  tableWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 200,
    maxHeight: 400,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  tableHorizontalScroll: {
    flex: 1,
  },
  tableContainer: {
    minWidth: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    position: 'sticky',
    top: 0,
    zIndex: 10,
    ...Platform.select({
      web: {
        position: 'sticky',
      },
    }),
  },
  headerCell: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRightWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerText: {
    fontSize: Platform.select({ web: 12, default: 11 }),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableBodyScroll: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    minHeight: 40,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
      },
    }),
  },
  tableCell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRightWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  cellText: {
    fontSize: Platform.select({ web: 13, default: 12 }),
  },
});

