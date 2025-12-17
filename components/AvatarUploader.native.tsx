import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert, Platform, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { showAppToast } from '@/components/ui/app-toast';
import { autoSquareCrop } from '@/lib/avatar/auto-square-crop';

interface AvatarUploaderProps {
  value?: string | null;
  onChange?: (uri: string | null) => void;
  size?: number;
  disabled?: boolean;
}

export function AvatarUploader({
  value,
  onChange,
  size = 110,
  disabled = false,
}: AvatarUploaderProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePickImage = async () => {
    if (disabled || isProcessing) return;

    try {
      // Request media library permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to select a photo!'
        );
        return;
      }

      // Launch image picker (no built-in crop - we'll do it ourselves)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled) {
        return;
      }

      if (!result.assets || result.assets.length === 0) {
        return;
      }

      const selectedAsset = result.assets[0];
      const selectedUri = selectedAsset.uri;

      if (!selectedUri) {
        return;
      }

      setIsProcessing(true);

      try {
        // Check original file size
        const fileInfo = await FileSystem.getInfoAsync(selectedUri);
        
        if (!fileInfo.exists) {
          throw new Error('File does not exist');
        }

        const fileSizeInBytes = fileInfo.size || 0;
        const maxSizeBytes = 10 * 1024 * 1024; // 10 MB

        if (fileSizeInBytes > maxSizeBytes) {
          showAppToast('This photo is too large. Please choose an image under 10 MB.');
          setIsProcessing(false);
          return;
        }

        // Immediately center-crop to square (no black bars)
        const squareUri = await autoSquareCrop(selectedUri);

        // Update avatar with square-cropped URI (already square, ready for preview/save)
        onChange?.(squareUri);
      } catch (error) {
        console.error('Error processing image:', Platform.OS, error);
        showAppToast('We couldn\'t process this photo. Please try a different one.');
      } finally {
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error in image picker:', Platform.OS, error);
      showAppToast('We couldn\'t process this photo. Please try a different image.');
      setIsProcessing(false);
    }
  };

  const cameraButtonSize = size / 3;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePickImage}
        disabled={disabled || isProcessing}
        activeOpacity={0.8}
        style={[
          styles.avatarContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
        accessibilityLabel="Profile photo"
        accessibilityHint="Double tap to select a photo from your gallery"
        accessibilityRole="button"
      >
        {value ? (
          <Image
            source={{ uri: value }}
            style={[
              styles.avatarImage,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
              },
            ]}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              styles.placeholderContainer,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
              },
            ]}
          >
            <MaterialIcons name="person" size={size * 0.5} color="#9CA3AF" />
          </View>
        )}
        
        {/* Processing overlay */}
        {isProcessing && (
          <View
            style={[
              styles.processingOverlay,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
              },
            ]}
          >
            <ActivityIndicator size="small" color="#14B8A6" />
          </View>
        )}
      </TouchableOpacity>

      {/* Camera button overlay */}
      <TouchableOpacity
        onPress={handlePickImage}
        disabled={disabled || isProcessing}
        activeOpacity={0.8}
        style={[
          styles.cameraButton,
          {
            width: cameraButtonSize,
            height: cameraButtonSize,
            borderRadius: cameraButtonSize / 2,
            bottom: 0,
            right: 0,
          },
        ]}
        accessibilityLabel="Change photo"
        accessibilityHint="Double tap to select a different photo"
        accessibilityRole="button"
      >
        <MaterialIcons name="camera-alt" size={cameraButtonSize * 0.5} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  avatarContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButton: {
    position: 'absolute',
    backgroundColor: '#14B8A6', // Teal color
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
