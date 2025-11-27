import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Switch,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

type GoalType = {
  daily_calories_lower?: number;
  daily_calories_upper?: number;
  daily_protein_g?: number;
  max_carbs_g?: number; // Total Carbs
  net_carbs_g?: number;
  fibre_target_g?: number;
  max_fats_g?: number; // Total Fat
  max_saturated_fat_g?: number;
  max_sodium_mg?: number;
  water_target_ml?: number;
  target_weight_lb?: number;
  target_date?: string;
};

export default function MyGoalsScreen() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [goals, setGoals] = useState<GoalType>({
    daily_calories_lower: undefined,
    daily_calories_upper: undefined,
    daily_protein_g: undefined,
    max_carbs_g: undefined,
    net_carbs_g: undefined,
    fibre_target_g: undefined,
    max_fats_g: undefined,
    max_saturated_fat_g: undefined,
    max_sodium_mg: undefined,
    water_target_ml: undefined,
    target_weight_lb: undefined,
    target_date: undefined,
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enableLowerRange, setEnableLowerRange] = useState(false);
  const [enableUpperRange, setEnableUpperRange] = useState(false);
  const [enableProtein, setEnableProtein] = useState(false);
  const [enableMaxCarbs, setEnableMaxCarbs] = useState(false);
  const [enableNetCarbs, setEnableNetCarbs] = useState(false);
  const [enableFibre, setEnableFibre] = useState(false);
  const [enableMaxFats, setEnableMaxFats] = useState(false);
  const [enableMaxSaturatedFat, setEnableMaxSaturatedFat] = useState(false);
  const [enableMaxSodium, setEnableMaxSodium] = useState(false);
  const [enableWater, setEnableWater] = useState(false);
  const [enableTargetWeight, setEnableTargetWeight] = useState(false);
  const [targetWeightUnit, setTargetWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [targetWeightKg, setTargetWeightKg] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Load goals from database
  useEffect(() => {
    loadGoals();
  }, [user]);

  const loadGoals = async () => {
    if (!user?.id) {
      setInitialLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('daily_calorie_goal_lower, daily_calorie_goal_upper, daily_calorie_goal, daily_protein_goal_g, max_carbs_goal_g, net_carbs_goal_g, fibre_target_g, max_fats_goal_g, max_saturated_fat_goal_g, max_sodium_mg, water_target_ml, target_weight_lb, target_date')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error loading goals:', fetchError);
      }

      if (data) {
        // Handle backward compatibility: if old daily_calorie_goal exists but new fields don't, use it as both lower and upper
        let lower = data.daily_calorie_goal_lower || undefined;
        let upper = data.daily_calorie_goal_upper || undefined;
        
        // If old single goal exists and new range fields don't, migrate it
        if (data.daily_calorie_goal && !lower && !upper) {
          lower = data.daily_calorie_goal;
          upper = data.daily_calorie_goal;
        }
        
        setGoals({
          daily_calories_lower: lower,
          daily_calories_upper: upper,
          daily_protein_g: data.daily_protein_goal_g || undefined,
          max_carbs_g: data.max_carbs_goal_g || undefined,
          net_carbs_g: data.net_carbs_goal_g || undefined,
          fibre_target_g: data.fibre_target_g || undefined,
          max_fats_g: data.max_fats_goal_g || undefined,
          max_saturated_fat_g: data.max_saturated_fat_goal_g || undefined,
          max_sodium_mg: data.max_sodium_mg || undefined,
          water_target_ml: data.water_target_ml || undefined,
          target_weight_lb: data.target_weight_lb || undefined,
          target_date: data.target_date || undefined,
        });
        
        // Set toggles based on whether values exist
        setEnableLowerRange(lower !== undefined && lower !== null);
        setEnableUpperRange(upper !== undefined && upper !== null);
        setEnableProtein(data.daily_protein_goal_g !== undefined && data.daily_protein_goal_g !== null);
        setEnableMaxCarbs(data.max_carbs_goal_g !== undefined && data.max_carbs_goal_g !== null);
        setEnableNetCarbs(data.net_carbs_goal_g !== undefined && data.net_carbs_goal_g !== null);
        setEnableFibre(data.fibre_target_g !== undefined && data.fibre_target_g !== null);
        setEnableMaxFats(data.max_fats_goal_g !== undefined && data.max_fats_goal_g !== null);
        setEnableMaxSaturatedFat(data.max_saturated_fat_goal_g !== undefined && data.max_saturated_fat_goal_g !== null);
        setEnableMaxSodium(data.max_sodium_mg !== undefined && data.max_sodium_mg !== null);
        setEnableWater(data.water_target_ml !== undefined && data.water_target_ml !== null);
        setEnableTargetWeight(data.target_weight_lb !== undefined && data.target_weight_lb !== null);
        
        // Initialize target weight display
        if (data.target_weight_lb) {
          const kg = data.target_weight_lb / 2.20462;
          setTargetWeightKg(kg.toFixed(1));
        }
        
        // Initialize selectedDate from target_date
        if (data.target_date) {
          const targetDate = new Date(data.target_date + 'T00:00:00');
          if (!isNaN(targetDate.getTime())) {
            setSelectedDate(targetDate);
          } else {
            // Default to 10 months later if invalid date
            const defaultDate = new Date();
            defaultDate.setMonth(defaultDate.getMonth() + 10);
            setSelectedDate(defaultDate);
          }
        } else {
          // Default to 10 months later if no target date
          const defaultDate = new Date();
          defaultDate.setMonth(defaultDate.getMonth() + 10);
          setSelectedDate(defaultDate);
        }
      } else {
        // Default to 10 months later if no data
        const defaultDate = new Date();
        defaultDate.setMonth(defaultDate.getMonth() + 10);
        setSelectedDate(defaultDate);
      }
    } catch (error: any) {
      console.error('Error loading goals:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const validateForm = (): string | null => {
    // Lower Range validation: must be 0 or higher
    if (goals.daily_calories_lower !== undefined && goals.daily_calories_lower < 0) {
      return 'Lower Range must be 0 or higher';
    }

    // Upper Range validation: must be 20000 or lower
    if (goals.daily_calories_upper !== undefined && goals.daily_calories_upper > 20000) {
      return 'Upper Range must be 20000 or lower';
    }

    // If both toggles are on, Lower Range must be smaller than Upper Range
    if (enableLowerRange && enableUpperRange && 
        goals.daily_calories_lower !== undefined && 
        goals.daily_calories_upper !== undefined && 
        goals.daily_calories_lower >= goals.daily_calories_upper) {
      return 'Lower Range must be smaller than Upper Range';
    }

    if (goals.daily_protein_g !== undefined) {
      if (goals.daily_protein_g < 20 || goals.daily_protein_g > 500) {
        return 'Protein must be between 20 and 500 grams';
      }
      if (goals.daily_protein_g.toString().length > 3) {
        return 'Protein must be 3 characters or less';
      }
    }

    if (goals.max_carbs_g !== undefined && (goals.max_carbs_g < 0 || goals.max_carbs_g > 450)) {
      return 'Total Carbs must be between 0 and 450 grams';
    }

    if (goals.net_carbs_g !== undefined && (goals.net_carbs_g < 0 || goals.net_carbs_g > 450)) {
      return 'Net Carbs must be between 0 and 450 grams';
    }

    if (goals.fibre_target_g !== undefined && (goals.fibre_target_g < 10 || goals.fibre_target_g > 240)) {
      return 'Fibre target must be between 10 and 240 grams';
    }

    if (goals.max_fats_g !== undefined && (goals.max_fats_g < 0 || goals.max_fats_g > 150)) {
      return 'Total Fat must be between 0 and 150 grams';
    }

    if (goals.max_saturated_fat_g !== undefined && (goals.max_saturated_fat_g < 0 || goals.max_saturated_fat_g > 100)) {
      return 'Saturated Fat must be between 0 and 100 grams';
    }

    if (goals.max_sodium_mg !== undefined && (goals.max_sodium_mg < 0 || goals.max_sodium_mg > 6000)) {
      return 'Max Sodium must be between 0 and 6000 mg';
    }

    if (goals.water_target_ml !== undefined && (goals.water_target_ml < 1000 || goals.water_target_ml > 10000)) {
      return 'Water target must be between 1 and 10 liters (1000-10000 ml)';
    }

    if (goals.target_weight_lb !== undefined) {
      if (goals.target_weight_lb < 50 || goals.target_weight_lb > 800) {
        return 'Target weight must be between 50 and 800 lbs';
      }
    }

    if (goals.target_date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(goals.target_date)) {
        return 'Target date must be in YYYY-MM-DD format';
      }
      const targetDate = new Date(goals.target_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tenYearsFromNow = new Date();
      tenYearsFromNow.setFullYear(today.getFullYear() + 10);
      tenYearsFromNow.setHours(23, 59, 59, 999);
      
      if (targetDate < today) {
        return 'Target date must be in the future';
      }
      if (targetDate > tenYearsFromNow) {
        return 'Target date must be within 10 years from today';
      }
    }

    return null;
  };

  const handleSave = async () => {
    setError(null);

    if (!user?.id) {
      setError('User not authenticated');
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      Alert.alert('Validation Error', validationError);
      return;
    }

    setLoading(true);

    try {
      const updateData: any = {};
      
      if (goals.daily_calories_lower !== undefined) {
        updateData.daily_calorie_goal_lower = goals.daily_calories_lower;
      } else {
        updateData.daily_calorie_goal_lower = null;
      }
      
      if (goals.daily_calories_upper !== undefined) {
        updateData.daily_calorie_goal_upper = goals.daily_calories_upper;
      } else {
        updateData.daily_calorie_goal_upper = null;
      }
      if (goals.daily_protein_g !== undefined) {
        updateData.daily_protein_goal_g = goals.daily_protein_g;
      } else {
        updateData.daily_protein_goal_g = null;
      }
      if (goals.max_carbs_g !== undefined) {
        updateData.max_carbs_goal_g = goals.max_carbs_g;
      } else {
        updateData.max_carbs_goal_g = null;
      }
      if (goals.net_carbs_g !== undefined) {
        updateData.net_carbs_goal_g = goals.net_carbs_g;
      } else {
        updateData.net_carbs_goal_g = null;
      }
      if (goals.fibre_target_g !== undefined) {
        updateData.fibre_target_g = goals.fibre_target_g;
      } else {
        updateData.fibre_target_g = null;
      }
      if (goals.max_fats_g !== undefined) {
        updateData.max_fats_goal_g = goals.max_fats_g;
      } else {
        updateData.max_fats_goal_g = null;
      }
      if (goals.max_saturated_fat_g !== undefined) {
        updateData.max_saturated_fat_goal_g = goals.max_saturated_fat_g;
      } else {
        updateData.max_saturated_fat_goal_g = null;
      }
      if (goals.max_sodium_mg !== undefined) {
        updateData.max_sodium_mg = goals.max_sodium_mg;
      } else {
        updateData.max_sodium_mg = null;
      }
      if (goals.water_target_ml !== undefined) {
        updateData.water_target_ml = goals.water_target_ml;
      } else {
        updateData.water_target_ml = null;
      }
      if (goals.target_weight_lb !== undefined) {
        updateData.target_weight_lb = goals.target_weight_lb;
      }
      if (goals.target_date !== undefined) {
        updateData.target_date = goals.target_date || null;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      if (updateError) {
        const errorMsg = `Failed to update goals: ${updateError.message}`;
        setError(errorMsg);
        Alert.alert('Update Failed', errorMsg);
        setLoading(false);
        return;
      }

      // Success - navigate back
      Alert.alert('Success', 'Goals updated successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to update goals. Please try again.';
      setError(errorMessage);
      Alert.alert('Update Failed', errorMessage);
      setLoading(false);
    }
  };

  const handleClear = (field: keyof GoalType) => {
    setGoals(prev => ({ ...prev, [field]: undefined }));
  };

  // Handle date selection from picker
  const handleDateUpdate = (date: Date) => {
    setSelectedDate(date);
    // Convert to YYYY-MM-DD format
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setGoals(prev => ({ ...prev, target_date: `${year}-${month}-${day}` }));
  };

  // Initialize default target date (10 months later) when toggle is turned on
  useEffect(() => {
    if (enableTargetWeight && !goals.target_date) {
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 10);
      setSelectedDate(defaultDate);
      const year = defaultDate.getFullYear();
      const month = String(defaultDate.getMonth() + 1).padStart(2, '0');
      const day = String(defaultDate.getDate()).padStart(2, '0');
      setGoals(prev => ({ ...prev, target_date: `${year}-${month}-${day}` }));
    }
  }, [enableTargetWeight]);

  // Handle closing the date picker
  const handleDatePickerClose = () => {
    setShowDatePicker(false);
  };

  if (initialLoading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={[styles.loadingText, { color: colors.icon }]}>
          Loading goals...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { borderBottomColor: colors.icon + '20' }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={[styles.headerTitle, { color: colors.text }]}>
          My Goals
        </ThemedText>
        <TouchableOpacity
          style={[
            styles.checkmarkButton,
            {
              opacity: loading ? 0.4 : 1,
            }
          ]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.7}
        >
          <IconSymbol 
            name="checkmark" 
            size={24} 
            color={loading ? colors.icon : colors.tint}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.scrollContent}>
          <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
            Set your daily nutrition and weight goals
          </ThemedText>

        <View style={styles.form}>
          {/* Daily Calories Goal */}
          <View style={styles.goalSection}>
            <View style={styles.goalHeader}>
              <View style={[styles.goalIconContainer, { backgroundColor: colors.tint + '15' }]}>
                <IconSymbol name="chart.bar.fill" size={20} color={colors.tint} />
              </View>
              <View style={styles.goalHeaderText}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Daily Calories Target</ThemedText>
                <ThemedText style={[styles.description, { color: colors.icon }]}>
                  Set optional lower and/or upper range
                </ThemedText>
              </View>
            </View>
            <View style={styles.rangeContainer}>
              {/* Upper Range */}
              <View style={styles.rangeRowWithToggle}>
                <View style={styles.toggleContainer}>
                  <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>Set Maximum (kcal)</ThemedText>
                  <Switch
                    value={enableUpperRange}
                    onValueChange={(value) => {
                      setEnableUpperRange(value);
                      if (!value) {
                        setGoals(prev => ({ ...prev, daily_calories_upper: undefined }));
                      }
                    }}
                    trackColor={{ false: colors.border, true: colors.tint + '60' }}
                    thumbColor={enableUpperRange ? colors.tint : colors.textTertiary}
                  />
                </View>
                <View style={styles.rangeInputContainerRight}>
                  <View style={styles.inputRowRight}>
                    <TextInput
                      style={[
                        styles.inputHalfWidth,
                        { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                        !enableUpperRange && { opacity: 0.5 }
                      ]}
                      placeholder="e.g., 2200"
                      placeholderTextColor={colors.textSecondary}
                      value={goals.daily_calories_upper?.toString() || ''}
                      onChangeText={(text) => {
                        if (!enableUpperRange) return;
                        const value = text === '' ? undefined : parseInt(text, 10);
                        setGoals(prev => ({ ...prev, daily_calories_upper: isNaN(value as number) ? undefined : value }));
                      }}
                      keyboardType="numeric"
                      editable={enableUpperRange}
                    />
                    {goals.daily_calories_upper !== undefined && enableUpperRange && (
                      <TouchableOpacity
                        style={styles.clearButton}
                        onPress={() => handleClear('daily_calories_upper')}
                      >
                        <IconSymbol name="xmark" size={16} color={colors.icon} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
              
              {/* Lower Range */}
              <View style={styles.rangeRowWithToggle}>
                <View style={styles.toggleContainer}>
                  <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>Set Minimum (kcal)</ThemedText>
                  <Switch
                    value={enableLowerRange}
                    onValueChange={(value) => {
                      setEnableLowerRange(value);
                      if (!value) {
                        setGoals(prev => ({ ...prev, daily_calories_lower: undefined }));
                      }
                    }}
                    trackColor={{ false: colors.border, true: colors.tint + '60' }}
                    thumbColor={enableLowerRange ? colors.tint : colors.textTertiary}
                  />
                </View>
                <View style={styles.rangeInputContainerRight}>
                  <View style={styles.inputRowRight}>
                    <TextInput
                      style={[
                        styles.inputHalfWidth,
                        { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                        !enableLowerRange && { opacity: 0.5 }
                      ]}
                      placeholder="e.g., 1800"
                      placeholderTextColor={colors.textSecondary}
                      value={goals.daily_calories_lower?.toString() || ''}
                      onChangeText={(text) => {
                        if (!enableLowerRange) return;
                        const value = text === '' ? undefined : parseInt(text, 10);
                        setGoals(prev => ({ ...prev, daily_calories_lower: isNaN(value as number) ? undefined : value }));
                      }}
                      keyboardType="numeric"
                      editable={enableLowerRange}
                    />
                    {goals.daily_calories_lower !== undefined && enableLowerRange && (
                      <TouchableOpacity
                        style={styles.clearButton}
                        onPress={() => handleClear('daily_calories_lower')}
                      >
                        <IconSymbol name="xmark" size={16} color={colors.icon} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Daily Nutrients Goal */}
          <View style={styles.goalSection}>
            <View style={styles.goalHeader}>
              <View style={[styles.goalIconContainer, { backgroundColor: colors.tint + '15' }]}>
                <IconSymbol name="chart.bar.fill" size={20} color={colors.tint} />
              </View>
              <View style={styles.goalHeaderText}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Daily Nutrients Target</ThemedText>
                <ThemedText style={[styles.description, { color: colors.icon }]}>
                  Target protein intake per day
                </ThemedText>
              </View>
            </View>
            <View style={styles.rangeRowWithToggle}>
              <View style={styles.toggleContainer}>
                <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>Set Protein Target (g)</ThemedText>
                <Switch
                  value={enableProtein}
                  onValueChange={(value) => {
                    setEnableProtein(value);
                    if (!value) {
                      setGoals(prev => ({ ...prev, daily_protein_g: undefined }));
                    }
                  }}
                  trackColor={{ false: colors.border, true: colors.tint + '60' }}
                  thumbColor={enableProtein ? colors.tint : colors.textTertiary}
                />
              </View>
              <View style={styles.rangeInputContainerRight}>
                <View style={styles.inputRowRight}>
                  <TextInput
                    style={[
                      styles.inputHalfWidth,
                      { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                      !enableProtein && { opacity: 0.5 }
                    ]}
                    placeholder="e.g., 150"
                    placeholderTextColor={colors.textSecondary}
                    value={goals.daily_protein_g?.toString() || ''}
                    onChangeText={(text) => {
                      if (!enableProtein) return;
                      // Limit to 3 characters
                      if (text.length > 3) return;
                      const value = text === '' ? undefined : parseInt(text, 10);
                      setGoals(prev => ({ ...prev, daily_protein_g: isNaN(value as number) ? undefined : value }));
                    }}
                    keyboardType="numeric"
                    editable={enableProtein}
                    maxLength={3}
                  />
                  {goals.daily_protein_g !== undefined && enableProtein && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => handleClear('daily_protein_g')}
                    >
                      <IconSymbol name="xmark" size={16} color={colors.icon} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
            
            {/* Max Sodium */}
            <View style={styles.rangeRowWithToggle}>
              <View style={styles.toggleContainer}>
                <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>Set Max Sodium (mg)</ThemedText>
                <Switch
                  value={enableMaxSodium}
                  onValueChange={(value) => {
                    setEnableMaxSodium(value);
                    if (!value) {
                      setGoals(prev => ({ ...prev, max_sodium_mg: undefined }));
                    }
                  }}
                  trackColor={{ false: colors.border, true: colors.tint + '60' }}
                  thumbColor={enableMaxSodium ? colors.tint : colors.textTertiary}
                />
              </View>
              <View style={styles.rangeInputContainerRight}>
                <View style={styles.inputRowRight}>
                  <TextInput
                    style={[
                      styles.inputHalfWidth,
                      { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                      !enableMaxSodium && { opacity: 0.5 }
                    ]}
                    placeholder="e.g., 2300"
                    placeholderTextColor={colors.textSecondary}
                    value={goals.max_sodium_mg?.toString() || ''}
                    onChangeText={(text) => {
                      if (!enableMaxSodium) return;
                      const value = text === '' ? undefined : parseInt(text, 10);
                      setGoals(prev => ({ ...prev, max_sodium_mg: isNaN(value as number) ? undefined : value }));
                    }}
                    keyboardType="numeric"
                    editable={enableMaxSodium}
                  />
                  {goals.max_sodium_mg !== undefined && enableMaxSodium && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => handleClear('max_sodium_mg')}
                    >
                      <IconSymbol name="xmark" size={16} color={colors.icon} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Max Carbohydrates */}
          <View style={styles.goalSection}>
            <View style={styles.rangeRowWithToggle}>
            <View style={styles.toggleContainer}>
              <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>Set Max Total Carbs (g)</ThemedText>
              <Switch
                value={enableMaxCarbs}
                onValueChange={(value) => {
                  setEnableMaxCarbs(value);
                  if (!value) {
                    setGoals(prev => ({ ...prev, max_carbs_g: undefined }));
                  }
                }}
                trackColor={{ false: colors.border, true: colors.tint + '60' }}
                thumbColor={enableMaxCarbs ? colors.tint : colors.textTertiary}
              />
            </View>
            <View style={styles.rangeInputContainerRight}>
              <View style={styles.inputRowRight}>
                <TextInput
                  style={[
                    styles.inputHalfWidth,
                    { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                    !enableMaxCarbs && { opacity: 0.5 }
                  ]}
                  placeholder="e.g., 200"
                  placeholderTextColor={colors.textSecondary}
                  value={goals.max_carbs_g?.toString() || ''}
                  onChangeText={(text) => {
                    if (!enableMaxCarbs) return;
                    const value = text === '' ? undefined : parseInt(text, 10);
                    setGoals(prev => ({ ...prev, max_carbs_g: isNaN(value as number) ? undefined : value }));
                  }}
                  keyboardType="numeric"
                  editable={enableMaxCarbs}
                />
                {goals.max_carbs_g !== undefined && enableMaxCarbs && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => handleClear('max_carbs_g')}
                  >
                    <IconSymbol name="xmark" size={16} color={colors.icon} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
          </View>

          {/* Net Carbs */}
          <View style={styles.goalSection}>
            <View style={styles.rangeRowWithToggle}>
            <View style={styles.toggleContainer}>
              <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>Set Max Net Carbs (g)</ThemedText>
              <Switch
                value={enableNetCarbs}
                onValueChange={(value) => {
                  setEnableNetCarbs(value);
                  if (!value) {
                    setGoals(prev => ({ ...prev, net_carbs_g: undefined }));
                  }
                }}
                trackColor={{ false: colors.border, true: colors.tint + '60' }}
                thumbColor={enableNetCarbs ? colors.tint : colors.textTertiary}
              />
            </View>
            <View style={styles.rangeInputContainerRight}>
              <View style={styles.inputRowRight}>
                <TextInput
                  style={[
                    styles.inputHalfWidth,
                    { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                    !enableNetCarbs && { opacity: 0.5 }
                  ]}
                  placeholder="e.g., 150"
                  placeholderTextColor={colors.textSecondary}
                  value={goals.net_carbs_g?.toString() || ''}
                  onChangeText={(text) => {
                    if (!enableNetCarbs) return;
                    const value = text === '' ? undefined : parseInt(text, 10);
                    setGoals(prev => ({ ...prev, net_carbs_g: isNaN(value as number) ? undefined : value }));
                  }}
                  keyboardType="numeric"
                  editable={enableNetCarbs}
                />
                {goals.net_carbs_g !== undefined && enableNetCarbs && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => handleClear('net_carbs_g')}
                  >
                    <IconSymbol name="xmark" size={16} color={colors.icon} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
          </View>

          {/* Fibre Target */}
          <View style={styles.goalSection}>
            <View style={styles.rangeRowWithToggle}>
            <View style={styles.toggleContainer}>
              <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>Set Fibre Target (g)</ThemedText>
              <Switch
                value={enableFibre}
                onValueChange={(value) => {
                  setEnableFibre(value);
                  if (!value) {
                    setGoals(prev => ({ ...prev, fibre_target_g: undefined }));
                  }
                }}
                trackColor={{ false: colors.border, true: colors.tint + '60' }}
                thumbColor={enableFibre ? colors.tint : colors.textTertiary}
              />
            </View>
            <View style={styles.rangeInputContainerRight}>
              <View style={styles.inputRowRight}>
                <TextInput
                  style={[
                    styles.inputHalfWidth,
                    { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                    !enableFibre && { opacity: 0.5 }
                  ]}
                  placeholder="e.g., 30"
                  placeholderTextColor={colors.textSecondary}
                  value={goals.fibre_target_g?.toString() || ''}
                  onChangeText={(text) => {
                    if (!enableFibre) return;
                    const value = text === '' ? undefined : parseInt(text, 10);
                    setGoals(prev => ({ ...prev, fibre_target_g: isNaN(value as number) ? undefined : value }));
                  }}
                  keyboardType="numeric"
                  editable={enableFibre}
                />
                {goals.fibre_target_g !== undefined && enableFibre && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => handleClear('fibre_target_g')}
                  >
                    <IconSymbol name="xmark" size={16} color={colors.icon} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
          </View>

          {/* Max Fats */}
          <View style={styles.goalSection}>
            <View style={styles.rangeRowWithToggle}>
            <View style={styles.toggleContainer}>
              <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>Set Max Total Fat (g)</ThemedText>
              <Switch
                value={enableMaxFats}
                onValueChange={(value) => {
                  setEnableMaxFats(value);
                  if (!value) {
                    setGoals(prev => ({ ...prev, max_fats_g: undefined }));
                  }
                }}
                trackColor={{ false: colors.border, true: colors.tint + '60' }}
                thumbColor={enableMaxFats ? colors.tint : colors.textTertiary}
              />
            </View>
            <View style={styles.rangeInputContainerRight}>
              <View style={styles.inputRowRight}>
                <TextInput
                  style={[
                    styles.inputHalfWidth,
                    { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                    !enableMaxFats && { opacity: 0.5 }
                  ]}
                  placeholder="e.g., 65"
                  placeholderTextColor={colors.textSecondary}
                  value={goals.max_fats_g?.toString() || ''}
                  onChangeText={(text) => {
                    if (!enableMaxFats) return;
                    const value = text === '' ? undefined : parseInt(text, 10);
                    setGoals(prev => ({ ...prev, max_fats_g: isNaN(value as number) ? undefined : value }));
                  }}
                  keyboardType="numeric"
                  editable={enableMaxFats}
                />
                {goals.max_fats_g !== undefined && enableMaxFats && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => handleClear('max_fats_g')}
                  >
                    <IconSymbol name="xmark" size={16} color={colors.icon} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
          </View>

          {/* Max Saturated Fat */}
          <View style={styles.goalSection}>
            <View style={styles.rangeRowWithToggle}>
            <View style={styles.toggleContainer}>
              <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>Set Max Saturated Fat (g)</ThemedText>
              <Switch
                value={enableMaxSaturatedFat}
                onValueChange={(value) => {
                  setEnableMaxSaturatedFat(value);
                  if (!value) {
                    setGoals(prev => ({ ...prev, max_saturated_fat_g: undefined }));
                  }
                }}
                trackColor={{ false: colors.border, true: colors.tint + '60' }}
                thumbColor={enableMaxSaturatedFat ? colors.tint : colors.textTertiary}
              />
            </View>
            <View style={styles.rangeInputContainerRight}>
              <View style={styles.inputRowRight}>
                <TextInput
                  style={[
                    styles.inputHalfWidth,
                    { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                    !enableMaxSaturatedFat && { opacity: 0.5 }
                  ]}
                  placeholder="e.g., 20"
                  placeholderTextColor={colors.textSecondary}
                  value={goals.max_saturated_fat_g?.toString() || ''}
                  onChangeText={(text) => {
                    if (!enableMaxSaturatedFat) return;
                    const value = text === '' ? undefined : parseInt(text, 10);
                    setGoals(prev => ({ ...prev, max_saturated_fat_g: isNaN(value as number) ? undefined : value }));
                  }}
                  keyboardType="numeric"
                  editable={enableMaxSaturatedFat}
                />
                {goals.max_saturated_fat_g !== undefined && enableMaxSaturatedFat && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => handleClear('max_saturated_fat_g')}
                  >
                    <IconSymbol name="xmark" size={16} color={colors.icon} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
          </View>

          {/* Water Target */}
          <View style={styles.goalSection}>
            <View style={styles.rangeRowWithToggle}>
            <View style={styles.toggleContainer}>
              <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>Set Water Target (L)</ThemedText>
              <Switch
                value={enableWater}
                onValueChange={(value) => {
                  setEnableWater(value);
                  if (!value) {
                    setGoals(prev => ({ ...prev, water_target_ml: undefined }));
                  }
                }}
                trackColor={{ false: colors.border, true: colors.tint + '60' }}
                thumbColor={enableWater ? colors.tint : colors.textTertiary}
              />
            </View>
            <View style={styles.rangeInputContainerRight}>
              <View style={styles.inputRowRight}>
                <TextInput
                  style={[
                    styles.inputHalfWidth,
                    { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                    !enableWater && { opacity: 0.5 }
                  ]}
                  placeholder="e.g., 2"
                  placeholderTextColor={colors.textSecondary}
                  value={goals.water_target_ml ? (goals.water_target_ml / 1000).toString() : ''}
                  onChangeText={(text) => {
                    if (!enableWater) return;
                    const liters = text === '' ? undefined : parseFloat(text);
                    const ml = liters !== undefined && !isNaN(liters) ? Math.round(liters * 1000) : undefined;
                    setGoals(prev => ({ ...prev, water_target_ml: ml }));
                  }}
                  keyboardType="numeric"
                  editable={enableWater}
                />
                {goals.water_target_ml !== undefined && enableWater && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => handleClear('water_target_ml')}
                  >
                    <IconSymbol name="xmark" size={16} color={colors.icon} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
          </View>

          {/* Target Weight */}
          <View style={styles.goalSection}>
            <View style={styles.goalHeader}>
              <View style={[styles.goalIconContainer, { backgroundColor: colors.tint + '15' }]}>
                <IconSymbol name="ruler.fill" size={20} color={colors.tint} />
              </View>
              <View style={[styles.goalHeaderText, { flex: 1 }]}>
                <View style={styles.measurementHeader}>
                  <ThemedText style={[styles.label, { color: colors.text }]}>Target Weight</ThemedText>
                  <View style={styles.unitToggle}>
                    <TouchableOpacity
                      style={[
                        styles.unitButton,
                        { borderColor: colors.icon + '40' },
                        targetWeightUnit === 'lbs' && { backgroundColor: colors.tint, borderColor: colors.tint },
                      ]}
                      onPress={() => {
                        setTargetWeightUnit('lbs');
                        // Convert kg to lbs when switching
                        if (targetWeightKg) {
                          const lbs = parseFloat(targetWeightKg) * 2.20462;
                          setGoals(prev => ({ ...prev, target_weight_lb: isNaN(lbs) ? undefined : lbs }));
                        }
                      }}
                    >
                      <Text style={[styles.unitButtonText, { color: targetWeightUnit === 'lbs' ? '#fff' : colors.text }]}>
                        lbs
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.unitButton,
                        { borderColor: colors.icon + '40' },
                        targetWeightUnit === 'kg' && { backgroundColor: colors.tint, borderColor: colors.tint },
                      ]}
                      onPress={() => {
                        setTargetWeightUnit('kg');
                        // Convert lbs to kg when switching
                        if (goals.target_weight_lb) {
                          const kg = goals.target_weight_lb / 2.20462;
                          setTargetWeightKg(kg.toFixed(1));
                        }
                      }}
                    >
                      <Text style={[styles.unitButtonText, { color: targetWeightUnit === 'kg' ? '#fff' : colors.text }]}>
                        kg
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Your goal weight */}
            <View style={styles.rangeRowWithToggle}>
              <View style={styles.toggleContainer}>
                <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>Set Target Weight ({targetWeightUnit === 'lbs' ? 'lbs' : 'kg'})</ThemedText>
                <View style={styles.toggleRow}>
                  <Switch
                    value={enableTargetWeight}
                    onValueChange={(value) => {
                      setEnableTargetWeight(value);
                      if (!value) {
                        setGoals(prev => ({ ...prev, target_weight_lb: undefined }));
                        setTargetWeightKg('');
                      }
                    }}
                    trackColor={{ false: colors.border, true: colors.tint + '60' }}
                    thumbColor={enableTargetWeight ? colors.tint : colors.textTertiary}
                  />
                </View>
              </View>
              <View style={styles.rangeInputContainerRight}>
                <View style={styles.inputRowRight}>
                  {targetWeightUnit === 'lbs' ? (
                    <TextInput
                      style={[
                        styles.inputHalfWidth,
                        { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                        !enableTargetWeight && { opacity: 0.5 }
                      ]}
                      placeholder="50 to 800"
                      placeholderTextColor={colors.textSecondary}
                      value={goals.target_weight_lb?.toString() || ''}
                      onChangeText={(text) => {
                        if (!enableTargetWeight) return;
                        const value = text === '' ? undefined : parseFloat(text);
                        setGoals(prev => ({ ...prev, target_weight_lb: isNaN(value as number) ? undefined : value }));
                      }}
                      keyboardType="numeric"
                      editable={enableTargetWeight}
                    />
                  ) : (
                    <TextInput
                      style={[
                        styles.inputHalfWidth,
                        { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                        !enableTargetWeight && { opacity: 0.5 }
                      ]}
                      placeholder="23 to 363"
                      placeholderTextColor={colors.textSecondary}
                      value={targetWeightKg}
                      onChangeText={(text) => {
                        if (!enableTargetWeight) return;
                        setTargetWeightKg(text);
                        const kg = text === '' ? undefined : parseFloat(text);
                        if (kg !== undefined && !isNaN(kg)) {
                          const lbs = kg * 2.20462;
                          setGoals(prev => ({ ...prev, target_weight_lb: lbs }));
                        } else {
                          setGoals(prev => ({ ...prev, target_weight_lb: undefined }));
                        }
                      }}
                      keyboardType="numeric"
                      editable={enableTargetWeight}
                    />
                  )}
                  {goals.target_weight_lb !== undefined && enableTargetWeight && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => {
                        handleClear('target_weight_lb');
                        setTargetWeightKg('');
                      }}
                    >
                      <IconSymbol name="xmark" size={16} color={colors.icon} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
            
            {/* Target Date within Target Weight section */}
            <View style={styles.rangeRowWithToggle}>
              <View style={styles.toggleContainer}>
                <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>Set Target Date</ThemedText>
              </View>
              <View style={styles.rangeInputContainerRight}>
                <View style={styles.inputRowRight}>
                  <TouchableOpacity
                    style={[
                      styles.inputFullWidth,
                      { 
                        borderColor: colors.border, 
                        backgroundColor: colors.background,
                        borderWidth: 1,
                        borderRadius: 12,
                        padding: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      },
                      !enableTargetWeight && { opacity: 0.5 }
                    ]}
                    onPress={() => {
                      if (enableTargetWeight) {
                        setShowDatePicker(true);
                      }
                    }}
                    activeOpacity={enableTargetWeight ? 0.7 : 1}
                  >
                    <ThemedText style={[styles.dateInputText, { color: goals.target_date ? colors.text : colors.textSecondary }]}>
                      {goals.target_date || 'Select Target Date'}
                    </ThemedText>
                    <IconSymbol name="calendar" size={20} color={colors.icon} />
                  </TouchableOpacity>
                  {goals.target_date && enableTargetWeight && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => {
                        handleClear('target_date');
                        const defaultDate = new Date();
                        defaultDate.setMonth(defaultDate.getMonth() + 10);
                        setSelectedDate(defaultDate);
                      }}
                    >
                      <IconSymbol name="xmark" size={16} color={colors.icon} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>

          {error && (
            <View style={[styles.errorContainer, { backgroundColor: '#EF4444' + '20', borderColor: '#EF4444' }]}>
              <ThemedText style={[styles.errorText, { color: '#EF4444' }]}>
                {error}
              </ThemedText>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.tint }]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Save Goals</Text>
            )}
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity
          style={styles.datePickerModalOverlay}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.datePickerModalContent, { backgroundColor: colors.background }]}>
              <View style={[styles.datePickerHeader, { borderBottomColor: colors.icon + '20' }]}>
                <ThemedText style={[styles.datePickerTitle, { color: colors.text }]}>
                  Select Target Date
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={styles.datePickerCloseButton}
                >
                  <IconSymbol name="xmark" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.datePickerBody}>
                {/* Year Picker */}
                <View style={styles.datePickerRow}>
                  <ThemedText style={[styles.datePickerLabel, { color: colors.icon }]}>
                    Year
                  </ThemedText>
                  <ScrollView style={styles.datePickerScrollView} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 11 }, (_, i) => {
                      const year = new Date().getFullYear() + i;
                      const today = new Date();
                      const minYear = today.getFullYear();
                      
                      // Only show years from today onwards (up to 10 years)
                      if (year < minYear) return null;
                      
                      return (
                        <TouchableOpacity
                          key={year}
                          style={[
                            styles.datePickerOption,
                            selectedDate.getFullYear() === year && { backgroundColor: colors.tint + '20' },
                          ]}
                          onPress={() => {
                            const newDate = new Date(selectedDate);
                            newDate.setFullYear(year);
                            // Ensure date is not in the past
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            if (newDate < today) {
                              newDate.setTime(today.getTime());
                            }
                            handleDateUpdate(newDate);
                          }}
                        >
                          <ThemedText
                            style={[
                              styles.datePickerOptionText,
                              { color: selectedDate.getFullYear() === year ? colors.tint : colors.text },
                            ]}
                          >
                            {year}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    }).filter(Boolean)}
                  </ScrollView>
                </View>

                {/* Month Picker */}
                <View style={styles.datePickerRow}>
                  <ThemedText style={[styles.datePickerLabel, { color: colors.icon }]}>
                    Month
                  </ThemedText>
                  <ScrollView style={styles.datePickerScrollView} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = i + 1;
                      const monthName = new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'short' });
                      return (
                        <TouchableOpacity
                          key={month}
                          style={[
                            styles.datePickerOption,
                            selectedDate.getMonth() + 1 === month && { backgroundColor: colors.tint + '20' },
                          ]}
                          onPress={() => {
                            const newDate = new Date(selectedDate);
                            newDate.setMonth(i);
                            // Ensure date is not in the past
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            if (newDate < today) {
                              newDate.setTime(today.getTime());
                            }
                            handleDateUpdate(newDate);
                          }}
                        >
                          <ThemedText
                            style={[
                              styles.datePickerOptionText,
                              { color: selectedDate.getMonth() + 1 === month ? colors.tint : colors.text },
                            ]}
                          >
                            {monthName}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Day Picker */}
                <View style={styles.datePickerRow}>
                  <ThemedText style={[styles.datePickerLabel, { color: colors.icon }]}>
                    Day
                  </ThemedText>
                  <ScrollView style={styles.datePickerScrollView} showsVerticalScrollIndicator={false}>
                    {Array.from(
                      { length: new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate() },
                      (_, i) => {
                        const day = i + 1;
                        return (
                          <TouchableOpacity
                            key={day}
                            style={[
                              styles.datePickerOption,
                              selectedDate.getDate() === day && { backgroundColor: colors.tint + '20' },
                            ]}
                            onPress={() => {
                              const newDate = new Date(selectedDate);
                              newDate.setDate(day);
                              // Ensure date is not in the past
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              if (newDate < today) {
                                newDate.setTime(today.getTime());
                              }
                              handleDateUpdate(newDate);
                            }}
                          >
                            <ThemedText
                              style={[
                                styles.datePickerOptionText,
                                { color: selectedDate.getDate() === day ? colors.tint : colors.text },
                              ]}
                            >
                              {day}
                            </ThemedText>
                          </TouchableOpacity>
                        );
                      }
                    )}
                  </ScrollView>
                </View>
              </View>
              <View style={[styles.datePickerFooter, { borderTopColor: colors.icon + '20' }]}>
                <TouchableOpacity
                  style={[styles.datePickerDoneButton, { backgroundColor: colors.tint }]}
                  onPress={handleDatePickerClose}
                >
                  <Text style={styles.datePickerDoneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.select({ web: 20, default: 50 }),
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  checkmarkButton: {
    marginLeft: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContentContainer: {
    flexGrow: 1,
    alignItems: 'center',
  },
  scrollContent: {
    width: '100%',
    maxWidth: 600,
    ...Platform.select({
      web: {
        padding: 16,
        paddingTop: 30,
        paddingBottom: 16,
      },
      default: {
        padding: 20,
        paddingBottom: 32,
      },
    }),
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  form: {
    gap: 20,
  },
  goalSection: {
    gap: 12,
  },
  rangeContainer: {
    gap: 16,
  },
  rangeRowWithToggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  toggleContainer: {
    flex: 1,
    gap: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  rangeInputContainerRight: {
    flex: 1,
    gap: 0,
    alignItems: 'flex-start',
  },
  inputHalfWidth: {
    width: '60%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  inputFullWidth: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goalIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalHeaderText: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    opacity: 0.7,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-start',
    width: '100%',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  unit: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 40,
  },
  clearButton: {
    padding: 8,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 50,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  measurementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  unitToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  unitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputText: {
    fontSize: 16,
  },
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  datePickerCloseButton: {
    padding: 4,
  },
  datePickerBody: {
    padding: 16,
    flexDirection: Platform.select({ web: 'row', default: 'row' }),
    maxHeight: 400,
    gap: 12,
  },
  datePickerRow: {
    ...Platform.select({
      web: {
        marginBottom: 16,
      },
      default: {
        flex: 1,
      },
    }),
  },
  datePickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  datePickerScrollView: {
    ...Platform.select({
      web: {
        maxHeight: 200,
      },
      default: {
        flex: 1,
        maxHeight: 200,
      },
    }),
  },
  datePickerOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    alignItems: 'center',
  },
  datePickerOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  datePickerFooter: {
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  datePickerDoneButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  datePickerDoneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

