import { useState, useEffect, useCallback } from 'react';
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
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ageFromDob } from '@/utils/calculations';
import { supabase } from '@/lib/supabase';
import {
  getButtonAccessibilityProps,
  getInputAccessibilityProps,
  getMinTouchTargetStyle,
  getFocusStyle,
  getWebAccessibilityProps,
} from '@/utils/accessibility';


type Gender = 'male' | 'female' | 'not_telling';

export default function EditProfileScreen() {
  const { profile, user, refreshProfile } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [firstName, setFirstName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLb, setWeightLb] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Function to load profile data into form fields
  const loadProfileData = useCallback((profileData: any) => {
    if (profileData) {
      setFirstName(profileData.first_name || '');
      setDateOfBirth(profileData.date_of_birth || '');
      // Map old gender values to new ones, or default to 'male'
      const profileGender = profileData.gender;
      if (profileGender === 'male' || profileGender === 'female' || profileGender === 'not_telling') {
        setGender(profileGender);
      } else {
        // Map old values (nonbinary, prefer_not_to_say) to 'not_telling'
        setGender('not_telling');
      }
      const heightCmValue = profileData.height_cm?.toString() || '';
      setHeightCm(heightCmValue);
      // Convert cm to ft/in for display
      if (heightCmValue) {
        const totalInches = parseFloat(heightCmValue) / 2.54;
        const feet = Math.floor(totalInches / 12);
        const inches = Math.round(totalInches % 12);
        setHeightFt(feet.toString());
        setHeightIn(inches.toString());
      }
      
      const weightLbValue = profileData.weight_lb?.toString() || '';
      setWeightLb(weightLbValue);
      // Convert lbs to kg for display
      if (weightLbValue) {
        const kgValue = (parseFloat(weightLbValue) / 2.20462).toFixed(1);
        setWeightKg(kgValue);
      }
      
      // Initialize selectedDate from dateOfBirth
      if (profileData.date_of_birth) {
        const dobDate = new Date(profileData.date_of_birth + 'T00:00:00');
        if (!isNaN(dobDate.getTime())) {
          setSelectedDate(dobDate);
        }
      }
      
      setInitialLoading(false);
    } else if (!profileData && user) {
      // If no profile but user exists, still show form (though this shouldn't happen)
      setInitialLoading(false);
    }
  }, [user]);

  // Load unit preferences from profile data
  useEffect(() => {
    if (profile) {
      // Load unit preferences from database
      const heightUnitPref = (profile.height_unit === 'ft' ? 'ft' : 'cm') as 'cm' | 'ft';
      const weightUnitPref = (profile.weight_unit === 'kg' ? 'kg' : 'lbs') as 'lbs' | 'kg';
      
      setHeightUnit(heightUnitPref);
      setWeightUnit(weightUnitPref);
      
      // Load profile data after setting unit preferences
      loadProfileData(profile);
    } else if (user && !profile) {
      // If user exists but no profile, we're done loading
      setInitialLoading(false);
    }
  }, [profile, user, loadProfileData]);

  // Function to save unit preference to database
  const saveUnitPreference = async (unitType: 'height' | 'weight', unit: string) => {
    if (!user?.id) return;
    
    try {
      const updateData: any = {};
      if (unitType === 'height') {
        updateData.height_unit = unit;
      } else {
        updateData.weight_unit = unit;
      }
      
      await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error saving unit preference:', error);
    }
  };

  // Reload profile data when page comes into focus (e.g., after saving)
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        // Fetch fresh profile data from database
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              loadProfileData(data);
            }
          });
      }
    }, [user?.id, loadProfileData])
  );

  // Convert selectedDate to YYYY-MM-DD format
  useEffect(() => {
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setDateOfBirth(`${year}-${month}-${day}`);
    }
  }, [selectedDate]);

  // Handle date selection from picker (updates date but doesn't close)
  const handleDateUpdate = (date: Date) => {
    setSelectedDate(date);
  };

  // Handle closing the date picker and finalizing the date
  const handleDatePickerClose = () => {
    setShowDatePicker(false);
  };

  // Input filtering functions - only allow numbers and at most one decimal point
  const filterNumericInput = (text: string): string => {
    // Remove all characters except numbers and decimal point
    let filtered = text.replace(/[^0-9.]/g, '');
    // Only allow one decimal point
    const parts = filtered.split('.');
    if (parts.length > 2) {
      filtered = parts[0] + '.' + parts.slice(1).join('');
    }
    return filtered;
  };

  // Conversion functions
  const convertHeightToCm = (): number | null => {
    if (heightUnit === 'cm') {
      const cm = parseFloat(heightCm);
      return isNaN(cm) ? null : cm;
    } else {
      const ft = parseFloat(heightFt);
      const inches = parseFloat(heightIn);
      if (isNaN(ft) || isNaN(inches)) return null;
      const totalInches = ft * 12 + inches;
      return totalInches * 2.54;
    }
  };

  const convertWeightToLb = (): number | null => {
    if (weightUnit === 'lbs') {
      const lbs = parseFloat(weightLb);
      return isNaN(lbs) ? null : lbs;
    } else {
      const kg = parseFloat(weightKg);
      return isNaN(kg) ? null : kg * 2.20462;
    }
  };

  const validateForm = (): string | null => {
    if (!firstName || !dateOfBirth) {
      return 'Preferred Name and Date of Birth are required';
    }

    // Validate preferred name length
    if (firstName.length > 40) {
      return 'Preferred Name must be 40 characters or less';
    }

    // Validate date format and age
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateOfBirth)) {
      return 'Date of birth must be in YYYY-MM-DD format';
    }

    const dobDate = new Date(dateOfBirth + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if date is in the future
    if (dobDate > today) {
      return 'Date of birth cannot be in the future';
    }

    const actualAge = ageFromDob(dateOfBirth);

    if (actualAge < 13) {
      return 'You must be at least 13 years old';
    }

    if (actualAge > 150) {
      return 'Date of birth cannot be more than 150 years ago';
    }

    const heightCmValue = convertHeightToCm();
    if (!heightCmValue) {
      return 'Height is required';
    }

    const weightLbValue = convertWeightToLb();
    if (!weightLbValue) {
      return 'Weight is required';
    }

    const height = heightCmValue;
    const weight = weightLbValue;

    // Height: max 10 feet = 304.8 cm, min 50 cm
    if (height < 50 || height > 304.8) {
      return 'Height must be between 50 cm and 304.8 cm (approximately 1\'8" to 10\'0")';
    }

    // Weight: max 1200 lbs, min 45 lbs
    if (weight < 45 || weight > 1200) {
      return 'Weight must be between 45 and 1200 lbs (approximately 20 to 544 kg)';
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
      const heightCmValue = convertHeightToCm();
      const weightLbValue = convertWeightToLb();

      if (!heightCmValue || !weightLbValue) {
        setError('Height and Weight are required');
        setLoading(false);
        Alert.alert('Validation Error', 'Height and Weight are required');
        return;
      }

      // Add timeout to prevent infinite loading
      const updateData = {
        first_name: firstName,
        date_of_birth: dateOfBirth,
        gender,
        height_cm: heightCmValue,
        weight_lb: weightLbValue,
        height_unit: heightUnit,
        weight_unit: weightUnit,
      };

      const updatePromise = supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Update request timed out after 10 seconds')), 10000);
      });

      const result = await Promise.race([updatePromise, timeoutPromise]) as any;
      const { error: updateError } = result;

      if (updateError) {
        console.error('Profile update error:', updateError);
        const errorMsg = `Failed to update profile: ${updateError.message}`;
        setError(errorMsg);
        setLoading(false);
        Alert.alert('Update Failed', errorMsg);
        return;
      }

      // Success - refresh profile in AuthContext and navigate back
      setLoading(false);
      
      // Refresh profile in AuthContext so it's updated when navigating back
      await refreshProfile();
      
      router.back();
    } catch (error: any) {
      console.error('Unexpected error updating profile:', error);
      const errorMessage = error.message || 'Failed to update profile. Please try again.';
      setError(errorMessage);
      setLoading(false);
      Alert.alert('Update Failed', errorMessage);
    }
  };

  if (initialLoading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading profile...
        </ThemedText>
      </ThemedView>
    );
  }

  if (!profile && user) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ThemedText type="title" style={[styles.errorTitle, { color: colors.text }]}>
          Profile Not Found
        </ThemedText>
        <ThemedText style={[styles.errorText, { color: colors.textSecondary }]}>
          Your profile could not be loaded. Please try again later.
        </ThemedText>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.tint }]}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
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
          Edit Profile
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          Update your personal information
        </ThemedText>

        <View style={styles.form}>
          <ThemedText style={[styles.label, { color: colors.text }]}>Preferred Name</ThemedText>
          <TextInput
            style={[styles.input, { borderColor: colors.icon + '40', color: colors.text, backgroundColor: colors.background }]}
            placeholder="Preferred Name"
            placeholderTextColor={colors.textSecondary}
            value={firstName}
            onChangeText={(text) => {
              if (text.length <= 40) {
                setFirstName(text);
              }
            }}
            maxLength={40}
            autoCapitalize="words"
          />

          <ThemedText style={[styles.label, { color: colors.text }]}>Date of Birth</ThemedText>
          <TouchableOpacity
            style={[styles.dateInput, { borderColor: colors.icon + '40', backgroundColor: colors.background }]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.dateInputText, { color: dateOfBirth ? colors.text : colors.textSecondary }]}>
              {dateOfBirth || 'Select Date of Birth'}
            </ThemedText>
            <IconSymbol name="calendar" size={20} color={colors.icon} />
          </TouchableOpacity>

          <ThemedText style={[styles.label, { color: colors.text }]}>Gender at Birth</ThemedText>
          <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
            For accuracy on caloric calculations
          </ThemedText>
          <View style={styles.genderContainer}>
            {(['male', 'female', 'not_telling'] as Gender[]).map((g) => {
              const displayText = g === 'not_telling' ? 'Not Telling' : g.charAt(0).toUpperCase() + g.slice(1);
              return (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.genderButton,
                    { borderColor: colors.icon + '40' },
                    gender === g && { backgroundColor: colors.tint, borderColor: colors.tint },
                  ]}
                  onPress={() => setGender(g)}
                >
                  <Text
                    style={[
                      styles.genderButtonText,
                      { color: gender === g ? '#fff' : colors.text },
                    ]}
                  >
                    {displayText}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Height */}
          <View style={styles.measurementSection}>
            <View style={styles.measurementHeader}>
              <ThemedText style={[styles.label, { color: colors.text }]}>Height</ThemedText>
              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[
                    styles.unitButton,
                    { borderColor: colors.icon + '40' },
                    heightUnit === 'cm' && { backgroundColor: colors.tint, borderColor: colors.tint },
                  ]}
                  onPress={() => {
                    setHeightUnit('cm');
                    // Save preference to database (don't await, fire and forget)
                    saveUnitPreference('height', 'cm');
                    // Convert ft/in to cm when switching
                    if (heightFt && heightIn) {
                      const totalInches = parseFloat(heightFt) * 12 + parseFloat(heightIn);
                      const cm = totalInches * 2.54;
                      setHeightCm(cm.toFixed(1));
                    }
                  }}
                >
                  <Text style={[styles.unitButtonText, { color: heightUnit === 'cm' ? '#fff' : colors.text }]}>
                    cm
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.unitButton,
                    { borderColor: colors.icon + '40' },
                    heightUnit === 'ft' && { backgroundColor: colors.tint, borderColor: colors.tint },
                  ]}
                  onPress={() => {
                    setHeightUnit('ft');
                    // Save preference to database (don't await, fire and forget)
                    saveUnitPreference('height', 'ft');
                    // Convert cm to ft/in when switching
                    if (heightCm) {
                      const totalInches = parseFloat(heightCm) / 2.54;
                      const feet = Math.floor(totalInches / 12);
                      const inches = Math.round(totalInches % 12);
                      setHeightFt(feet.toString());
                      setHeightIn(inches.toString());
                    }
                  }}
                >
                  <Text style={[styles.unitButtonText, { color: heightUnit === 'ft' ? '#fff' : colors.text }]}>
                    ft/in
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {heightUnit === 'cm' ? (
              <TextInput
                style={[styles.input, { borderColor: colors.icon + '40', color: colors.text, backgroundColor: colors.background }]}
                placeholder="50 to 304.8"
                placeholderTextColor={colors.textSecondary}
                value={heightCm}
                onChangeText={(text) => setHeightCm(filterNumericInput(text))}
                keyboardType="numeric"
              />
            ) : (
              <View style={styles.dualInputRow}>
                <View style={styles.dualInputContainer}>
                  <TextInput
                    style={[styles.input, { borderColor: colors.icon + '40', color: colors.text, backgroundColor: colors.background }]}
                    placeholder="ft (max 10)"
                    placeholderTextColor={colors.textSecondary}
                    value={heightFt}
                    onChangeText={(text) => setHeightFt(filterNumericInput(text))}
                    keyboardType="numeric"
                  />
                  <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>ft</Text>
                </View>
                <View style={styles.dualInputContainer}>
                  <TextInput
                    style={[styles.input, { borderColor: colors.icon + '40', color: colors.text, backgroundColor: colors.background }]}
                    placeholder="in"
                    placeholderTextColor={colors.textSecondary}
                    value={heightIn}
                    onChangeText={(text) => setHeightIn(filterNumericInput(text))}
                    keyboardType="numeric"
                  />
                  <Text style={[styles.unitLabel, { color: colors.icon }]}>in</Text>
                </View>
              </View>
            )}
          </View>

          {/* Weight */}
          <View style={styles.measurementSection}>
            <View style={styles.measurementHeader}>
              <ThemedText style={[styles.label, { color: colors.text }]}>Weight</ThemedText>
              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[
                    styles.unitButton,
                    { borderColor: colors.icon + '40' },
                    weightUnit === 'lbs' && { backgroundColor: colors.tint, borderColor: colors.tint },
                  ]}
                  onPress={() => {
                    setWeightUnit('lbs');
                    // Save preference to database (don't await, fire and forget)
                    saveUnitPreference('weight', 'lbs');
                    // Convert kg to lbs when switching
                    if (weightKg) {
                      const lbs = parseFloat(weightKg) * 2.20462;
                      setWeightLb(lbs.toFixed(1));
                    }
                  }}
                >
                  <Text style={[styles.unitButtonText, { color: weightUnit === 'lbs' ? '#fff' : colors.text }]}>
                    lbs
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.unitButton,
                    { borderColor: colors.icon + '40' },
                    weightUnit === 'kg' && { backgroundColor: colors.tint, borderColor: colors.tint },
                  ]}
                  onPress={() => {
                    setWeightUnit('kg');
                    // Save preference to database (don't await, fire and forget)
                    saveUnitPreference('weight', 'kg');
                    // Convert lbs to kg when switching
                    if (weightLb) {
                      const kg = parseFloat(weightLb) / 2.20462;
                      setWeightKg(kg.toFixed(1));
                    }
                  }}
                >
                  <Text style={[styles.unitButtonText, { color: weightUnit === 'kg' ? '#fff' : colors.text }]}>
                    kg
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {weightUnit === 'lbs' ? (
              <TextInput
                style={[styles.input, { borderColor: colors.icon + '40', color: colors.text, backgroundColor: colors.background }]}
                placeholder="45 to 1200"
                placeholderTextColor={colors.textSecondary}
                value={weightLb}
                onChangeText={(text) => setWeightLb(filterNumericInput(text))}
                keyboardType="numeric"
              />
            ) : (
              <TextInput
                style={[styles.input, { borderColor: colors.icon + '40', color: colors.text, backgroundColor: colors.background }]}
                placeholder="20 to 544"
                placeholderTextColor={colors.textSecondary}
                value={weightKg}
                onChangeText={(text) => setWeightKg(filterNumericInput(text))}
                keyboardType="numeric"
              />
            )}
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
              <Text style={styles.buttonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
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
                  Select Date of Birth
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
                  <ThemedText style={[styles.datePickerLabel, { color: colors.textSecondary }]}>
                    Year
                  </ThemedText>
                  <ScrollView style={styles.datePickerScrollView} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 150 }, (_, i) => {
                      const year = new Date().getFullYear() - i;
                      const maxYear = new Date().getFullYear();
                      // Don't show future years
                      if (year > maxYear) return null;
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
                            // Ensure date is not in the future
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            if (newDate > today) {
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
                  <ThemedText style={[styles.datePickerLabel, { color: colors.textSecondary }]}>
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
                            // Ensure date is not in the future
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            if (newDate > today) {
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
                  <ThemedText style={[styles.datePickerLabel, { color: colors.textSecondary }]}>
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
                              // Ensure date is not in the future
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              if (newDate > today) {
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
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 1,
  },
  description: {
    fontSize: 12,
    marginBottom: 12,
    opacity: 0.7,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
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
  genderContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
  },
  genderButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderButtonText: {
    fontSize: 14,
    fontWeight: '500',
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
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  measurementSection: {
    gap: 8,
  },
  measurementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  dualInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dualInputContainer: {
    flex: 1,
    gap: 4,
  },
  unitLabel: {
    fontSize: 12,
    fontWeight: '500',
    paddingLeft: 4,
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

