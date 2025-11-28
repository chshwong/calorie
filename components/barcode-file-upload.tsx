import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

// Load html5-qrcode from CDN for barcode decoding from images
let Html5Qrcode: any = null;
let Html5QrcodeSupportedFormats: any = null;
let loadingPromise: Promise<void> | null = null;

function loadHtml5QrcodeFromCDN(): Promise<void> {
  if (loadingPromise) return loadingPromise;
  if (Html5Qrcode) return Promise.resolve();
  
  loadingPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Not in browser environment'));
      return;
    }
    
    // Check if already loaded
    if ((window as any).Html5Qrcode) {
      Html5Qrcode = (window as any).Html5Qrcode;
      Html5QrcodeSupportedFormats = (window as any).Html5QrcodeSupportedFormats;
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    script.async = true;
    script.onload = () => {
      Html5Qrcode = (window as any).Html5Qrcode;
      Html5QrcodeSupportedFormats = (window as any).Html5QrcodeSupportedFormats;
      console.log('[BarcodeUpload] html5-qrcode loaded from CDN');
      console.log('[BarcodeUpload] Supported formats:', Html5QrcodeSupportedFormats);
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load barcode scanning library'));
    };
    document.head.appendChild(script);
  });
  
  return loadingPromise;
}

/**
 * Resize image if too large for reliable barcode detection.
 * Very large images can cause memory issues and slower detection.
 */
async function resizeImageIfNeeded(file: File, maxDimension: number = 1500): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      // Check if resize is needed
      if (img.width <= maxDimension && img.height <= maxDimension) {
        console.log(`[BarcodeUpload] Image size OK: ${img.width}x${img.height}`);
        resolve(file);
        return;
      }
      
      // Calculate new dimensions maintaining aspect ratio
      let newWidth = img.width;
      let newHeight = img.height;
      
      if (img.width > img.height) {
        newWidth = maxDimension;
        newHeight = (img.height / img.width) * maxDimension;
      } else {
        newHeight = maxDimension;
        newWidth = (img.width / img.height) * maxDimension;
      }
      
      console.log(`[BarcodeUpload] Resizing image from ${img.width}x${img.height} to ${Math.round(newWidth)}x${Math.round(newHeight)}`);
      
      // Create canvas and resize
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file); // Fallback to original if canvas fails
        return;
      }
      
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      
      // Convert to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const resizedFile = new File([blob], file.name, { type: 'image/jpeg' });
          resolve(resizedFile);
        } else {
          resolve(file);
        }
      }, 'image/jpeg', 0.9);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      console.error('[BarcodeUpload] Failed to load image for resize');
      resolve(file); // Fallback to original
    };
    
    img.src = url;
  });
}

type BarcodeFileUploadProps = {
  onBarcodeScanned: (result: { type: string; data: string }) => void;
  onError?: (error: string) => void;
  onSwitchToCamera?: () => void;
  cameraAvailable?: boolean;
  colors: {
    tint: string;
    text: string;
    background: string;
    textSecondary?: string;
  };
};

/**
 * File upload component for barcode scanning on web.
 * Allows users to upload an image of a barcode which is then decoded.
 * 
 * Used as a fallback when camera is not available on web platforms.
 */
export function BarcodeFileUpload({
  onBarcodeScanned,
  onError,
  onSwitchToCamera,
  cameraAvailable = false,
  colors,
}: BarcodeFileUploadProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const processImage = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setSelectedFileName(file.name);

    console.log(`[BarcodeUpload] Processing file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

    try {
      // Load the library if needed
      await loadHtml5QrcodeFromCDN();
      
      if (!Html5Qrcode) {
        throw new Error('Barcode scanning library not loaded');
      }

      // Resize image if too large
      const processedFile = await resizeImageIfNeeded(file, 1500);
      console.log(`[BarcodeUpload] File after processing: ${processedFile.size} bytes`);

      // Get supported formats - prioritize product barcodes
      const formatsToSupport = Html5QrcodeSupportedFormats ? [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.QR_CODE,
      ].filter(Boolean) : undefined;

      console.log('[BarcodeUpload] Formats to support:', formatsToSupport);

      // Create a temporary scanner instance with explicit format config
      const config = formatsToSupport ? { formatsToSupport } : undefined;
      const html5QrCode = new Html5Qrcode('barcode-file-scanner-temp', config);
      
      console.log('[BarcodeUpload] Starting file scan...');
      
      // Decode the barcode from the image file
      // The scanFile method signature: scanFile(file, showImage, config)
      const decodedResult = await html5QrCode.scanFile(processedFile, /* showImage */ false);
      
      console.log('[BarcodeUpload] Barcode decoded successfully:', decodedResult);
      
      // Clean up
      try {
        html5QrCode.clear();
      } catch (cleanupErr) {
        // Ignore cleanup errors
      }
      
      // Call the success handler with the decoded barcode
      onBarcodeScanned({
        type: 'ean13', // Most common for product barcodes
        data: decodedResult,
      });
      
    } catch (err: any) {
      console.error('[BarcodeUpload] Error decoding barcode from file:', err);
      console.error('[BarcodeUpload] Error name:', err?.name);
      console.error('[BarcodeUpload] Error message:', err?.message);
      
      let errorMessage = t('mealtype_log.scanner.file_decode_failed', 
        'Could not read barcode from image. Please try a clearer photo.');
      
      // Check for specific error types
      const errorStr = String(err?.message || err || '').toLowerCase();
      if (errorStr.includes('no barcode') || 
          errorStr.includes('no multiformat') ||
          errorStr.includes('notfounderror') ||
          errorStr.includes('notfoundexception')) {
        errorMessage = t('mealtype_log.scanner.no_barcode_found',
          'No barcode found in the image. Please try another photo.');
        console.log('[BarcodeUpload] Detection result: No barcode detected in image');
      } else {
        console.log('[BarcodeUpload] Detection result: Exception thrown -', err?.message);
      }
      
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [onBarcodeScanned, onError, t]);

  const handleFileSelect = useCallback((event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        const errorMsg = t('mealtype_log.scanner.invalid_file_type', 'Please select an image file.');
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        const errorMsg = t('mealtype_log.scanner.file_too_large', 'Image is too large. Please select a smaller file.');
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }
      
      processImage(file);
    }
    
    // Remove the input element after processing to ensure fresh input next time
    // This is important because browsers may not fire change events for the same file
    if (input && input.parentNode) {
      input.remove();
      if (fileInputRef.current === input) {
        fileInputRef.current = null;
      }
    }
  }, [processImage, onError, t]);

  const handleUploadClick = useCallback(() => {
    if (Platform.OS !== 'web') return;
    
    // Remove old input if it exists (forces fresh input each time)
    if (fileInputRef.current) {
      fileInputRef.current.removeEventListener('change', handleFileSelect);
      fileInputRef.current.remove();
      fileInputRef.current = null;
    }
    
    // Create fresh file input each time to ensure change event fires
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.addEventListener('change', handleFileSelect);
    document.body.appendChild(input);
    fileInputRef.current = input;
    
    // Trigger file picker
    fileInputRef.current.click();
  }, [handleFileSelect]);

  // Reset state when component mounts (e.g., when scanner reopens)
  React.useEffect(() => {
    setIsProcessing(false);
    setError(null);
    setSelectedFileName(null);
    
    // Clean up any existing file input from previous mount
    if (fileInputRef.current && fileInputRef.current.parentNode) {
      fileInputRef.current.remove();
      fileInputRef.current = null;
    }
  }, []); // Empty dependency array - only run on mount

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (fileInputRef.current) {
        fileInputRef.current.removeEventListener('change', handleFileSelect);
        fileInputRef.current.remove();
        fileInputRef.current = null;
      }
    };
  }, [handleFileSelect]);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Hidden div for html5-qrcode to use */}
      <div id="barcode-file-scanner-temp" style={{ display: 'none' }} />
      
      <View style={styles.iconContainer}>
        <Text style={[styles.icon, { color: colors.tint }]}>📷</Text>
      </View>
      
      <Text style={[styles.title, { color: colors.text }]}>
        {t('mealtype_log.scanner.upload_title', 'Upload a Barcode Photo')}
      </Text>
      
      <Text style={[styles.subtitle, { color: colors.textSecondary || '#666' }]}>
        {t('mealtype_log.scanner.upload_subtitle', 
          'Take a clear photo of the barcode and upload it here.')}
      </Text>
      
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: '#ffebee' }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {selectedFileName && !error && !isProcessing && (
        <Text style={[styles.fileName, { color: colors.textSecondary || '#666' }]}>
          {selectedFileName}
        </Text>
      )}
      
      <TouchableOpacity
        style={[
          styles.uploadButton,
          { 
            backgroundColor: isProcessing ? colors.tint + '80' : colors.tint,
            opacity: isProcessing ? 0.7 : 1,
          }
        ]}
        onPress={handleUploadClick}
        disabled={isProcessing}
        activeOpacity={0.7}
        accessibilityLabel={t('mealtype_log.scanner.upload_button', 'Select Image')}
        accessibilityHint={t('mealtype_log.scanner.upload_button_hint', 
          'Opens file picker to select a barcode image')}
      >
        {isProcessing ? (
          <View style={styles.buttonContent}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.buttonText}>
              {t('mealtype_log.scanner.processing', 'Processing...')}
            </Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>
            {t('mealtype_log.scanner.select_image', 'Select Image')}
          </Text>
        )}
      </TouchableOpacity>
      
      {cameraAvailable && onSwitchToCamera && (
        <TouchableOpacity
          style={styles.switchLink}
          onPress={onSwitchToCamera}
          activeOpacity={0.7}
        >
          <Text style={[styles.switchLinkText, { color: colors.tint }]}>
            {t('mealtype_log.scanner.try_camera', 'Try using camera instead')}
          </Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.tipsContainer}>
        <Text style={[styles.tipsTitle, { color: colors.text }]}>
          {t('mealtype_log.scanner.tips_title', 'Tips for best results:')}
        </Text>
        <Text style={[styles.tipText, { color: colors.textSecondary || '#666' }]}>
          • {t('mealtype_log.scanner.tip_1', 'Ensure good lighting')}
        </Text>
        <Text style={[styles.tipText, { color: colors.textSecondary || '#666' }]}>
          • {t('mealtype_log.scanner.tip_2', 'Hold camera steady and close')}
        </Text>
        <Text style={[styles.tipText, { color: colors.textSecondary || '#666' }]}>
          • {t('mealtype_log.scanner.tip_3', 'Make sure barcode is fully visible')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 16,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    maxWidth: 300,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
  },
  fileName: {
    fontSize: 12,
    marginBottom: 8,
  },
  uploadButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 160,
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchLink: {
    marginTop: 16,
    padding: 8,
  },
  switchLinkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  tipsContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 8,
    maxWidth: 280,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 20,
  },
});

export default BarcodeFileUpload;

