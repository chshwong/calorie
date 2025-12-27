import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ExternalFoodCache } from '@/utils/types';
import { mapExternalFoodToBase } from '@/lib/food/mapExternalFoodToBase';
import {
  getButtonAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
} from '@/utils/accessibility';

// Extended type that includes UI-only columns (not in DB)
type ExternalFoodCacheRow = ExternalFoodCache & {
  Is_Quality?: boolean;
  is_base_food?: boolean;
  order_index?: number;
  default_serving_size?: number;
  default_serving_unit?: string;
  default_serving_name?: string | null;
  Promote?: boolean;
  To_Delete?: boolean;
};

// Staging row type for items pending promotion to food_master
type StagingRow = {
  // Local UI id for React keys only, not DB id
  ui_id: string;
  // Link back to external_food_cache so we can stamp promoted_food_master_id
  external_food_cache_id: string;
  // Fields that will go into food_master (one row per StagingRow)
  name: string | null;
  brand: string | null;
  barcode: string | null;
  source: string | null;
  serving_size: number;
  serving_unit: string;
  calories_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  saturated_fat_g: number | null;
  unsaturated_fat_g: number | null;
  trans_fat_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  is_base_food: boolean;
  is_quality_data: boolean;
  order_index: number;
  // These are mostly constant but keep them explicit and editable if needed
  is_public: boolean;
  is_custom: boolean;
  owner_user_id: string | null;
};

// Column configuration for the grid
const COLUMN_CONFIG: {
  key: keyof ExternalFoodCacheRow;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'json' | 'datetime';
  width?: number;
}[] = [
  { key: 'To_Delete', label: 'To Delete', type: 'boolean', width: 100 },
  { key: 'barcode', label: 'Barcode', type: 'text', width: 120 },
  { key: 'source', label: 'Source', type: 'text', width: 120 },
  { key: 'product_name', label: 'Product Name', type: 'text', width: 200 },
  { key: 'brand', label: 'Brand', type: 'text', width: 150 },
  { key: 'energy_kcal_100g', label: 'Energy (kcal/100g)', type: 'number', width: 140 },
  { key: 'protein_100g', label: 'Protein (g/100g)', type: 'number', width: 130 },
  { key: 'carbs_100g', label: 'Carbs (g/100g)', type: 'number', width: 130 },
  { key: 'fat_100g', label: 'Fat (g/100g)', type: 'number', width: 120 },
  { key: 'saturated_fat_100g', label: 'Sat. Fat (g/100g)', type: 'number', width: 130 },
  { key: 'trans_fat_100g', label: 'Trans Fat (g/100g)', type: 'number', width: 130 },
  { key: 'sugars_100g', label: 'Sugars (g/100g)', type: 'number', width: 130 },
  { key: 'fiber_100g', label: 'Fiber (g/100g)', type: 'number', width: 120 },
  { key: 'sodium_100g', label: 'Sodium (g/100g)', type: 'number', width: 130 },
  { key: 'serving_size', label: 'Serving Size', type: 'text', width: 120 },
  { key: 'times_scanned', label: 'Times Scanned', type: 'number', width: 120 },
  { key: 'promoted_food_master_id', label: 'Promoted Food Master ID', type: 'text', width: 200 },
  { key: 'is_verified', label: 'Verified', type: 'boolean', width: 100 },
  { key: 'Is_Quality', label: 'Is Quality', type: 'boolean', width: 120 },
  { key: 'is_base_food', label: 'Is Base Food', type: 'boolean', width: 140 },
  { key: 'order_index', label: 'Order Index', type: 'number', width: 120 },
  { key: 'default_serving_size', label: 'Default Serving Size', type: 'number', width: 160 },
  { key: 'default_serving_unit', label: 'Default Serving Unit', type: 'text', width: 160 },
  { key: 'default_serving_name', label: 'Default Serving Name', type: 'text', width: 180 },
  { key: 'Promote', label: 'Promote', type: 'boolean', width: 100 },
  { key: 'created_at', label: 'Created At', type: 'datetime', width: 150 },
  { key: 'updated_at', label: 'Updated At', type: 'datetime', width: 150 },
];

// Column configuration for the staging grid
const STAGING_COLUMNS: {
  key: keyof StagingRow;
  label: string;
  type: 'text' | 'number' | 'boolean';
  editable: boolean;
}[] = [
  { key: 'name', label: 'Name', type: 'text', editable: true },
  { key: 'brand', label: 'Brand', type: 'text', editable: true },
  { key: 'barcode', label: 'Barcode', type: 'text', editable: true },
  { key: 'source', label: 'Source', type: 'text', editable: true },
  { key: 'serving_size', label: 'Serving Size', type: 'number', editable: true },
  { key: 'serving_unit', label: 'Serving Unit', type: 'text', editable: true },
  { key: 'calories_kcal', label: 'Calories (kcal)', type: 'number', editable: true },
  { key: 'protein_g', label: 'Protein (g)', type: 'number', editable: true },
  { key: 'carbs_g', label: 'Carbs (g)', type: 'number', editable: true },
  { key: 'fat_g', label: 'Fat (g)', type: 'number', editable: true },
  { key: 'fiber_g', label: 'Fiber (g)', type: 'number', editable: true },
  { key: 'saturated_fat_g', label: 'Sat. Fat (g)', type: 'number', editable: true },
  { key: 'unsaturated_fat_g', label: 'Unsat. Fat (g)', type: 'number', editable: true },
  { key: 'trans_fat_g', label: 'Trans Fat (g)', type: 'number', editable: true },
  { key: 'sugar_g', label: 'Sugar (g)', type: 'number', editable: true },
  { key: 'sodium_mg', label: 'Sodium (mg)', type: 'number', editable: true },
  { key: 'is_base_food', label: 'Base Food', type: 'boolean', editable: true },
  { key: 'is_quality_data', label: 'Quality Data', type: 'boolean', editable: true },
  { key: 'order_index', label: 'Order Index', type: 'number', editable: true },
  { key: 'is_public', label: 'Public', type: 'boolean', editable: true },
  { key: 'is_custom', label: 'Custom', type: 'boolean', editable: true },
];

export default function ExternalCacheFoodPromotionPage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { isAdmin, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<ExternalFoodCacheRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stagingRows, setStagingRows] = useState<StagingRow[]>([]);
  const [promotingToStaging, setPromotingToStaging] = useState(false);
  const [promotingToMaster, setPromotingToMaster] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());

  // Check admin access on focus
  useFocusEffect(
    useCallback(() => {
      if (!authLoading && !isAdmin) {
        Alert.alert('Access Denied', 'You do not have permission to access this page.');
        router.back();
      }
    }, [isAdmin, authLoading, router])
  );

  // Load top 100 cache rows
  useEffect(() => {
    if (isAdmin !== true) return;

    const loadRows = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('external_food_cache')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (fetchError) {
          setError(fetchError.message);
          setLoading(false);
          return;
        }

        // Ensure is_verified is boolean, defaulting to false if missing
        // Initialize UI-only columns with defaults
        const normalized = (data || []).map((row: any) => ({
          ...row,
          is_verified: !!row.is_verified,
          Is_Quality: row.Is_Quality !== undefined ? !!row.Is_Quality : true,
          is_base_food: row.is_base_food !== undefined ? !!row.is_base_food : true,
          order_index: row.order_index !== undefined ? Number(row.order_index) : 10000,
          default_serving_size: row.default_serving_size !== undefined ? Number(row.default_serving_size) : 100,
          default_serving_unit: row.default_serving_unit !== undefined ? String(row.default_serving_unit) : 'g',
          default_serving_name: row.default_serving_name !== undefined ? row.default_serving_name : null,
          Promote: row.Promote !== undefined ? !!row.Promote : false,
          To_Delete: row.To_Delete !== undefined ? !!row.To_Delete : false,
        })) as ExternalFoodCacheRow[];

        setRows(normalized);
        setDirtyIds(new Set());
      } catch (e: any) {
        setError(e.message ?? 'Failed to load cache records.');
      } finally {
        setLoading(false);
      }
    };

    loadRows();
  }, [isAdmin]);

  // Helper to generate UI IDs for staging rows
  const generateUIId = (): string => {
    // Use crypto.randomUUID() if available (web), otherwise fallback to timestamp + random
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const markDirty = useCallback((id: string) => {
    setDirtyIds((prev) => new Set(prev).add(id));
  }, []);

  const handleCellChange = useCallback((
    rowId: string,
    key: keyof ExternalFoodCacheRow,
    value: any,
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [key]: value,
            }
          : row,
      ),
    );
    markDirty(rowId);
  }, [markDirty]);

  const dirtyRows = useMemo(
    () => rows.filter((row) => dirtyIds.has(row.id)),
    [rows, dirtyIds],
  );

  const handleStagingCellChange = (
    uiId: string,
    key: keyof StagingRow,
    value: any,
  ) => {
    setStagingRows((prev) =>
      prev.map((row) =>
        row.ui_id === uiId
          ? { ...row, [key]: value }
          : row,
      ),
    );
  };

  const handleSave = async () => {
    if (!dirtyRows.length) return;

    setSaving(true);
    setError(null);

    try {
      // Separate rows to delete from rows to update
      const rowsToDelete = dirtyRows.filter((row) => row.To_Delete === true);
      const rowsToUpdate = dirtyRows.filter((row) => row.To_Delete !== true);

      // First, delete rows marked for deletion
      if (rowsToDelete.length > 0) {
        for (const row of rowsToDelete) {
          const { data: deleteData, error: deleteError } = await supabase
            .from('external_food_cache')
            .delete()
            .eq('id', row.id)
            .select();

          if (deleteError) {
            console.error('Delete error for row:', row.id, deleteError);
            throw new Error(`Failed to delete row ${row.id.substring(0, 8)}...: ${deleteError.message || deleteError.code || 'Unknown error'}`);
          }
          
          // Log successful deletion (in development only)
          if (process.env.NODE_ENV !== 'production' && deleteData && deleteData.length > 0) {
            console.log('Successfully deleted row:', row.id);
          }
        }
      }

      // Then, update rows that are not being deleted
      if (rowsToUpdate.length > 0) {
        for (const row of rowsToUpdate) {
          // Prepare payload – leave id and UI-only columns out of update body
          const {
            id,
            Is_Quality,
            is_base_food,
            order_index,
            default_serving_size,
            default_serving_unit,
            default_serving_name,
            Promote,
            To_Delete,
            ...updatePayload
          } = row;

          const { error: updateError } = await supabase
            .from('external_food_cache')
            .update(updatePayload)
            .eq('id', id);

          if (updateError) {
            throw updateError;
          }
        }
      }

      // Reload to re-sync from DB
      // Preserve UI-only column values from current rows (excluding deleted ones)
      const uiOnlyValuesMap = new Map<string, {
        Is_Quality?: boolean;
        is_base_food?: boolean;
        order_index?: number;
        default_serving_size?: number;
        default_serving_unit?: string;
        default_serving_name?: string | null;
        Promote?: boolean;
        To_Delete?: boolean;
      }>();
      rows.forEach((row) => {
        // Skip deleted rows
        if (row.To_Delete !== true) {
          uiOnlyValuesMap.set(row.id, {
            Is_Quality: row.Is_Quality,
            is_base_food: row.is_base_food,
            order_index: row.order_index,
            default_serving_size: row.default_serving_size,
            default_serving_unit: row.default_serving_unit,
            default_serving_name: row.default_serving_name,
            Promote: row.Promote,
            To_Delete: row.To_Delete,
          });
        }
      });

      const { data, error: reloadError } = await supabase
        .from('external_food_cache')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (reloadError) throw reloadError;

      const normalized = (data || []).map((row: any) => {
        const uiOnlyValues = uiOnlyValuesMap.get(row.id);
        return {
          ...row,
          is_verified: !!row.is_verified,
          Is_Quality: uiOnlyValues?.Is_Quality !== undefined ? uiOnlyValues.Is_Quality : true,
          is_base_food: uiOnlyValues?.is_base_food !== undefined ? uiOnlyValues.is_base_food : true,
          order_index: uiOnlyValues?.order_index !== undefined ? uiOnlyValues.order_index : 10000,
          default_serving_size: uiOnlyValues?.default_serving_size !== undefined ? uiOnlyValues.default_serving_size : 100,
          default_serving_unit: uiOnlyValues?.default_serving_unit !== undefined ? uiOnlyValues.default_serving_unit : 'g',
          default_serving_name: uiOnlyValues?.default_serving_name !== undefined ? uiOnlyValues.default_serving_name : null,
          Promote: uiOnlyValues?.Promote !== undefined ? uiOnlyValues.Promote : false,
          To_Delete: false, // Reset after save
        };
      }) as ExternalFoodCacheRow[];

      setRows(normalized);
      setDirtyIds(new Set());

      const deletedCount = rowsToDelete.length;
      const updatedCount = rowsToUpdate.length;
      let message = '';
      if (deletedCount > 0 && updatedCount > 0) {
        message = `Successfully deleted ${deletedCount} row${deletedCount > 1 ? 's' : ''} and updated ${updatedCount} row${updatedCount > 1 ? 's' : ''}.`;
      } else if (deletedCount > 0) {
        message = `Successfully deleted ${deletedCount} row${deletedCount > 1 ? 's' : ''}.`;
      } else {
        message = `Successfully saved ${updatedCount} row${updatedCount > 1 ? 's' : ''}.`;
      }
      Alert.alert('Success', message);
    } catch (e: any) {
      setError(e.message ?? 'Failed to save changes.');
      Alert.alert('Error', e.message ?? 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handlePromoteToStaging = async () => {
    const rowsToPromote = rows.filter((row) => row.Promote === true);
    if (!rowsToPromote.length) return;

    setPromotingToStaging(true);
    setError(null);

    try {
      const newStaging: StagingRow[] = rowsToPromote.map((row) => {
        const base = mapExternalFoodToBase({
          externalFood: row,
          servingSize: row.default_serving_size ?? 100,
          servingUnit: row.default_serving_unit ?? 'g',
        });

        return {
          ui_id: generateUIId(),
          external_food_cache_id: row.id,
          name: base.name,
          brand: base.brand,
          barcode: base.barcode,
          source: base.source,
          serving_size: base.serving_size,
          serving_unit: base.serving_unit,
          calories_kcal: base.calories_kcal,
          protein_g: base.protein_g,
          carbs_g: base.carbs_g,
          fat_g: base.fat_g,
          fiber_g: base.fiber_g,
          saturated_fat_g: base.saturated_fat_g,
          unsaturated_fat_g: base.unsaturated_fat_g,
          trans_fat_g: base.trans_fat_g,
          sugar_g: base.sugar_g,
          sodium_mg: base.sodium_mg,
          is_base_food: row.is_base_food ?? true,
          is_quality_data: row.Is_Quality ?? true,
          order_index: row.order_index ?? 10000,
          is_public: true,
          is_custom: false,
          owner_user_id: null,
        };
      });

      setStagingRows(newStaging);

      // Optionally clear promote flags after staging
      setRows((prev) =>
        prev.map((row) =>
          row.Promote
            ? { ...row, Promote: false }
            : row,
        ),
      );
    } catch (e: any) {
      setError(e.message ?? 'Failed to build staging rows.');
      Alert.alert('Error', e.message ?? 'Failed to build staging rows.');
    } finally {
      setPromotingToStaging(false);
    }
  };

  const handlePromoteStagingToFoodMaster = async () => {
    if (!stagingRows.length) return;

    setPromotingToMaster(true);
    setError(null);

    try {
      for (const staging of stagingRows) {
        const insertPayload = {
          name: staging.name,
          brand: staging.brand,
          barcode: staging.barcode,
          source: staging.source,
          serving_size: staging.serving_size,
          serving_unit: staging.serving_unit,
          calories_kcal: staging.calories_kcal,
          protein_g: staging.protein_g,
          carbs_g: staging.carbs_g,
          fat_g: staging.fat_g,
          fiber_g: staging.fiber_g,
          saturated_fat_g: staging.saturated_fat_g,
          unsaturated_fat_g: staging.unsaturated_fat_g,
          trans_fat_g: staging.trans_fat_g,
          sugar_g: staging.sugar_g,
          sodium_mg: staging.sodium_mg,
          is_base_food: staging.is_base_food,
          is_quality_data: staging.is_quality_data,
          order_index: staging.order_index,
          is_public: staging.is_public,
          is_custom: staging.is_custom,
          owner_user_id: staging.owner_user_id,
        };

        const { data: fm, error: fmError } = await supabase
          .from('food_master')
          .insert(insertPayload)
          .select('id')
          .single();

        if (fmError) throw fmError;
        if (!fm?.id) throw new Error('Failed to create food_master record.');

        const newFoodMasterId = fm.id;

        const { error: updateError } = await supabase
          .from('external_food_cache')
          .update({ promoted_food_master_id: newFoodMasterId })
          .eq('id', staging.external_food_cache_id);

        if (updateError) throw updateError;
      }

      // After success, reload the main grid from Supabase
      const { data, error: reloadError } = await supabase
        .from('external_food_cache')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (reloadError) throw reloadError;

      const normalized = (data || []).map((row: any) => ({
        ...row,
        is_verified: !!row.is_verified,
        // Keep the virtual fields with defaults
        Is_Quality: row.Is_Quality !== undefined ? !!row.Is_Quality : true,
        is_base_food: row.is_base_food !== undefined ? !!row.is_base_food : true,
        order_index: row.order_index !== undefined ? Number(row.order_index) : 10000,
        default_serving_size: row.default_serving_size !== undefined ? Number(row.default_serving_size) : 100,
        default_serving_unit: row.default_serving_unit !== undefined ? String(row.default_serving_unit) : 'g',
        default_serving_name: row.default_serving_name !== undefined ? row.default_serving_name : null,
        Promote: false,
        To_Delete: false,
      })) as ExternalFoodCacheRow[];

      setRows(normalized);
      setDirtyIds(new Set());
      setStagingRows([]);
      Alert.alert('Success', `Successfully promoted ${stagingRows.length} row${stagingRows.length > 1 ? 's' : ''} to food_master.`);
    } catch (e: any) {
      setError(e.message ?? 'Failed to promote staging rows to Food Master.');
      Alert.alert('Error', e.message ?? 'Failed to promote staging rows to Food Master.');
    } finally {
      setPromotingToMaster(false);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Don't render content if not admin
  if (authLoading || isAdmin === null) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={styles.loadingText}>Checking permissions…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!isAdmin) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText style={styles.errorText}>Access Denied</ThemedText>
          {error && <ThemedText style={styles.errorDetail}>{error}</ThemedText>}
        </View>
      </ThemedView>
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
          External Cache Food Promotion
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.content}>
          {error && (
            <View style={[styles.errorBanner, { backgroundColor: colors.errorBackground || '#fee' }]}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          )}

          {/* Buttons Row */}
          <View style={styles.buttonsRow}>
            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                getMinTouchTargetStyle(),
                {
                  backgroundColor: dirtyRows.length > 0 ? colors.tint : colors.border,
                  opacity: saving || dirtyRows.length === 0 ? 0.6 : 1,
                  flex: 1,
                  ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                },
              ]}
              onPress={handleSave}
              disabled={saving || dirtyRows.length === 0}
              activeOpacity={0.8}
              {...getButtonAccessibilityProps(
                'Save changes',
                `Double tap to save ${dirtyRows.length} changed row${dirtyRows.length !== 1 ? 's' : ''}`
              )}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.buttonContent}>
                  <IconSymbol name="checkmark.circle.fill" size={20} color="#fff" decorative={true} />
                  <Text style={styles.saveButtonText}>
                    SAVE{dirtyRows.length > 0 ? ` (${dirtyRows.length} row${dirtyRows.length > 1 ? 's' : ''} changed)` : ''}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Promote to Staging Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                getMinTouchTargetStyle(),
                {
                  backgroundColor: rows.some((r) => r.Promote === true) ? colors.tint : colors.border,
                  opacity: promotingToStaging || !rows.some((r) => r.Promote === true) ? 0.6 : 1,
                  flex: 1,
                  marginLeft: 8,
                  ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                },
              ]}
              onPress={handlePromoteToStaging}
              disabled={promotingToStaging || !rows.some((r) => r.Promote === true)}
              activeOpacity={0.8}
              {...getButtonAccessibilityProps(
                'Promote to Staging',
                'Double tap to promote selected foods to staging'
              )}
            >
              {promotingToStaging ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.buttonContent}>
                  <IconSymbol name="arrow.up.circle.fill" size={20} color="#fff" decorative={true} />
                  <Text style={styles.saveButtonText}>
                    Promote to Staging
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Promote Staging to Food Master Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                getMinTouchTargetStyle(),
                {
                  backgroundColor: stagingRows.length > 0 ? colors.tint : colors.border,
                  opacity: promotingToMaster || stagingRows.length === 0 ? 0.6 : 1,
                  flex: 1,
                  marginLeft: 8,
                  ...(Platform.OS === 'web' ? getFocusStyle('#fff') : {}),
                },
              ]}
              onPress={handlePromoteStagingToFoodMaster}
              disabled={promotingToMaster || stagingRows.length === 0}
              activeOpacity={0.8}
              {...getButtonAccessibilityProps(
                'Promote Staging to Food Master',
                'Double tap to promote staging rows to food_master'
              )}
            >
              {promotingToMaster ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.buttonContent}>
                  <IconSymbol name="arrow.up.circle.fill" size={20} color="#fff" decorative={true} />
                  <Text style={styles.saveButtonText}>
                    Promote Staging to Food Master
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.tint} />
              <ThemedText style={styles.loadingText}>Loading cache records…</ThemedText>
            </View>
          ) : rows.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>No cache records found.</ThemedText>
            </View>
          ) : (
            <ScrollView
              horizontal
              style={styles.tableScrollView}
              contentContainerStyle={styles.tableContainer}
              showsHorizontalScrollIndicator={true}
            >
              {/* Table */}
              <View style={styles.table}>
                {/* Header Row */}
                <View style={[styles.tableRow, styles.tableHeader, { borderBottomColor: colors.separator }]}>
                  <View style={[styles.tableCell, styles.idCell, { borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { fontWeight: 'bold' }]}>ID</ThemedText>
                  </View>
                  {COLUMN_CONFIG.map((col) => (
                    <View
                      key={col.key as string}
                      style={[
                        styles.tableCell,
                        { width: col.width || 150, borderRightColor: colors.separator },
                      ]}
                    >
                      <ThemedText style={[styles.headerText, { fontWeight: 'bold' }]}>
                        {col.label}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                {/* Data Rows */}
                {rows.map((row) => (
                  <View
                    key={row.id}
                    style={[
                      styles.tableRow,
                      dirtyIds.has(row.id) && styles.dirtyRow,
                      { borderBottomColor: colors.separator },
                    ]}
                  >
                    {/* ID Cell (non-editable) */}
                    <View style={[styles.tableCell, styles.idCell, { borderRightColor: colors.separator }]}>
                      <ThemedText
                        style={[styles.idText, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {row.id.substring(0, 8)}...
                      </ThemedText>
                    </View>

                    {/* Editable Cells */}
                    {COLUMN_CONFIG.map((col) => {
                      const value = row[col.key];

                      if (col.type === 'boolean') {
                        return (
                          <View
                            key={col.key as string}
                            style={[
                              styles.tableCell,
                              { width: col.width || 150, borderRightColor: colors.separator },
                            ]}
                          >
                            <Switch
                              value={!!value}
                              onValueChange={(checked) =>
                                handleCellChange(row.id, col.key, checked)
                              }
                              trackColor={{ false: colors.border, true: colors.tint }}
                              thumbColor="#fff"
                            />
                          </View>
                        );
                      }

                      if (col.type === 'number') {
                        return (
                          <View
                            key={col.key as string}
                            style={[
                              styles.tableCell,
                              { width: col.width || 150, borderRightColor: colors.separator },
                            ]}
                          >
                            <TextInput
                              style={[
                                styles.input,
                                {
                                  color: colors.text,
                                  borderColor: colors.border,
                                  backgroundColor: colors.backgroundSecondary,
                                },
                              ]}
                              value={value != null ? String(value) : ''}
                              onChangeText={(text) =>
                                handleCellChange(
                                  row.id,
                                  col.key,
                                  text === '' ? null : Number(text),
                                )
                              }
                              keyboardType="decimal-pad"
                              placeholder="—"
                              placeholderTextColor={colors.textSecondary}
                            />
                          </View>
                        );
                      }

                      if (col.type === 'json') {
                        const stringValue =
                          typeof value === 'string'
                            ? value
                            : value != null
                            ? JSON.stringify(value, null, 2)
                            : '';

                        return (
                          <View
                            key={col.key as string}
                            style={[
                              styles.tableCell,
                              styles.jsonCell,
                              { width: col.width || 250, borderRightColor: colors.separator },
                            ]}
                          >
                            <TextInput
                              style={[
                                styles.jsonInput,
                                {
                                  color: colors.text,
                                  borderColor: colors.border,
                                  backgroundColor: colors.backgroundSecondary,
                                },
                              ]}
                              value={stringValue}
                              onChangeText={(text) => handleCellChange(row.id, col.key, text)}
                              multiline
                              numberOfLines={3}
                              placeholder="{}"
                              placeholderTextColor={colors.textSecondary}
                              textAlignVertical="top"
                            />
                          </View>
                        );
                      }

                      if (col.type === 'datetime') {
                        return (
                          <View
                            key={col.key as string}
                            style={[
                              styles.tableCell,
                              { width: col.width || 150, borderRightColor: colors.separator },
                            ]}
                          >
                            <TextInput
                              style={[
                                styles.input,
                                {
                                  color: colors.text,
                                  borderColor: colors.border,
                                  backgroundColor: colors.backgroundSecondary,
                                },
                              ]}
                              value={formatDateTime(value as string | null)}
                              onChangeText={(text) => handleCellChange(row.id, col.key, text)}
                              placeholder="—"
                              placeholderTextColor={colors.textSecondary}
                            />
                          </View>
                        );
                      }

                      // text fallthrough
                      return (
                        <View
                          key={col.key as string}
                          style={[
                            styles.tableCell,
                            { width: col.width || 150, borderRightColor: colors.separator },
                          ]}
                        >
                          <TextInput
                            style={[
                              styles.input,
                              {
                                color: colors.text,
                                borderColor: colors.border,
                                backgroundColor: colors.backgroundSecondary,
                              },
                            ]}
                            value={value ?? ''}
                            onChangeText={(text) => handleCellChange(row.id, col.key, text)}
                            placeholder="—"
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Staging Grid */}
          <ThemedText type="title" style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>
            Staging
          </ThemedText>

          {stagingRows.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                No items in staging yet. Use "Promote to Staging" above.
              </ThemedText>
            </View>
          ) : (
            <ScrollView
              horizontal
              style={styles.tableScrollView}
              contentContainerStyle={styles.tableContainer}
              showsHorizontalScrollIndicator={true}
            >
              <View style={styles.table}>
                {/* Header Row */}
                <View style={[styles.tableRow, styles.tableHeader, { borderBottomColor: colors.separator }]}>
                  <View style={[styles.tableCell, styles.idCell, { borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { fontWeight: 'bold' }]}>External Cache ID</ThemedText>
                  </View>
                  {STAGING_COLUMNS.map((col) => (
                    <View
                      key={col.key as string}
                      style={[
                        styles.tableCell,
                        { width: col.type === 'number' ? 120 : col.type === 'boolean' ? 100 : 150, borderRightColor: colors.separator },
                      ]}
                    >
                      <ThemedText style={[styles.headerText, { fontWeight: 'bold' }]}>
                        {col.label}
                      </ThemedText>
                    </View>
                  ))}
                  <View style={[styles.tableCell, { width: 150, borderRightColor: colors.separator }]}>
                    <ThemedText style={[styles.headerText, { fontWeight: 'bold' }]}>Owner User ID</ThemedText>
                  </View>
                </View>

                {/* Data Rows */}
                {stagingRows.map((row) => (
                  <View
                    key={row.ui_id}
                    style={[
                      styles.tableRow,
                      { borderBottomColor: colors.separator },
                    ]}
                  >
                    {/* External Cache ID Cell */}
                    <View style={[styles.tableCell, styles.idCell, { borderRightColor: colors.separator }]}>
                      <ThemedText
                        style={[styles.idText, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {row.external_food_cache_id.substring(0, 8)}...
                      </ThemedText>
                    </View>

                    {/* Editable Cells */}
                    {STAGING_COLUMNS.map((col) => {
                      const value = row[col.key];

                      if (!col.editable) {
                        return (
                          <View
                            key={col.key as string}
                            style={[
                              styles.tableCell,
                              { width: col.type === 'number' ? 120 : col.type === 'boolean' ? 100 : 150, borderRightColor: colors.separator },
                            ]}
                          >
                            <ThemedText style={{ color: colors.textSecondary }}>
                              {String(value ?? '')}
                            </ThemedText>
                          </View>
                        );
                      }

                      if (col.type === 'boolean') {
                        return (
                          <View
                            key={col.key as string}
                            style={[
                              styles.tableCell,
                              { width: 100, borderRightColor: colors.separator },
                            ]}
                          >
                            <Switch
                              value={!!value}
                              onValueChange={(checked) =>
                                handleStagingCellChange(row.ui_id, col.key, checked)
                              }
                              trackColor={{ false: colors.border, true: colors.tint }}
                              thumbColor="#fff"
                            />
                          </View>
                        );
                      }

                      if (col.type === 'number') {
                        return (
                          <View
                            key={col.key as string}
                            style={[
                              styles.tableCell,
                              { width: 120, borderRightColor: colors.separator },
                            ]}
                          >
                            <TextInput
                              style={[
                                styles.input,
                                {
                                  color: colors.text,
                                  borderColor: colors.border,
                                  backgroundColor: colors.backgroundSecondary,
                                },
                              ]}
                              value={value != null ? String(value) : ''}
                              onChangeText={(text) =>
                                handleStagingCellChange(
                                  row.ui_id,
                                  col.key,
                                  text === '' ? null : Number(text),
                                )
                              }
                              keyboardType="decimal-pad"
                              placeholder="—"
                              placeholderTextColor={colors.textSecondary}
                            />
                          </View>
                        );
                      }

                      // text fallthrough
                      return (
                        <View
                          key={col.key as string}
                          style={[
                            styles.tableCell,
                            { width: 150, borderRightColor: colors.separator },
                          ]}
                        >
                          <TextInput
                            style={[
                              styles.input,
                              {
                                color: colors.text,
                                borderColor: colors.border,
                                backgroundColor: colors.backgroundSecondary,
                              },
                            ]}
                            value={value ?? ''}
                            onChangeText={(text) => handleStagingCellChange(row.ui_id, col.key, text)}
                            placeholder="—"
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>
                      );
                    })}

                    {/* Owner User ID Cell */}
                    <View style={[styles.tableCell, { width: 150, borderRightColor: colors.separator }]}>
                      <ThemedText style={[styles.idText, { color: colors.textSecondary }]}>
                        {row.owner_user_id ?? ''}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    width: '100%',
    padding: Platform.select({ web: 16, default: 16 }),
    paddingTop: 16,
  },
  errorBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  errorDetail: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  buttonsRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 16,
    gap: 8,
  },
  saveButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(10, 126, 164, 0.25)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: Platform.select({ web: 16, default: 16 }),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
    opacity: 0.7,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
  },
  sectionTitle: {
    fontSize: Platform.select({ web: 20, default: 18 }),
    fontWeight: 'bold',
    marginBottom: 12,
  },
  tableScrollView: {
    flex: 1,
  },
  tableContainer: {
    minWidth: '100%',
  },
  table: {
    minWidth: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 50,
    borderBottomWidth: 1,
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    minHeight: 40,
  },
  dirtyRow: {
    backgroundColor: '#fff9e6',
  },
  tableCell: {
    padding: 8,
    justifyContent: 'center',
    borderRightWidth: 1,
    minHeight: 50,
  },
  idCell: {
    width: 100,
    minWidth: 100,
  },
  jsonCell: {
    minHeight: 80,
  },
  headerText: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  idText: {
    fontSize: 10,
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 6,
    fontSize: 12,
    minHeight: 32,
  },
  jsonInput: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 6,
    fontSize: 10,
    fontFamily: Platform.select({ web: 'monospace', default: 'Courier' }),
    minHeight: 72,
  },
});

