import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

// Load html5-qrcode from CDN to avoid Metro bundler issues
let Html5Qrcode: any = null;
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
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    script.async = true;
    script.onload = () => {
      Html5Qrcode = (window as any).Html5Qrcode;
      console.log('html5-qrcode loaded from CDN');
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load html5-qrcode from CDN'));
    };
    document.head.appendChild(script);
  });
  
  return loadingPromise;
}

type WebBarcodeScannerProps = {
  onBarcodeScanned: (result: { type: string; data: string }) => void;
  onPermissionGranted?: () => void;
  onError?: (error: string) => void;
  /** Called when camera fails to start - parent should switch to file upload */
  onCameraFailed?: (error: string) => void;
  /** Called when user wants to switch to file upload manually */
  onSwitchToFileUpload?: () => void;
  colors: {
    tint: string;
    text: string;
    background: string;
    textSecondary?: string;
  };
};

export function WebBarcodeScanner({ 
  onBarcodeScanned, 
  onPermissionGranted,
  onError,
  onCameraFailed,
  onSwitchToFileUpload,
  colors 
}: WebBarcodeScannerProps) {
  const { t } = useTranslation();
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCameraError, setIsCameraError] = useState(false);
  const hasStartedRef = useRef(false);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const initScanner = async () => {
      // Load html5-qrcode from CDN
      try {
        await loadHtml5QrcodeFromCDN();
      } catch (loadError) {
        console.error('Failed to load html5-qrcode:', loadError);
        const errorMsg = t('mealtype_log.scanner.library_load_failed', 'Failed to load barcode scanner library');
        setError(errorMsg);
        setIsInitializing(false);
        return;
      }
      
      if (!Html5Qrcode) {
        const errorMsg = t('mealtype_log.scanner.library_load_failed', 'Failed to load barcode scanner library');
        setError(errorMsg);
        setIsInitializing(false);
        return;
      }
      
      // Prevent multiple starts
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;
      
      try {
        const scannerId = 'web-barcode-scanner';
        
        // Check if element exists
        const scannerElement = document.getElementById(scannerId);
        if (!scannerElement) {
          console.error('Scanner element not found');
          setError(t('mealtype_log.scanner.element_not_found', 'Scanner element not found'));
          setIsInitializing(false);
          return;
        }
        
        // Create scanner instance
        scannerRef.current = new Html5Qrcode(scannerId, {
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true // Use native BarcodeDetector API if available
          }
        });
        
        // Start scanning with back camera
        await scannerRef.current.start(
          { facingMode: 'environment' }, // Use back camera
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.777778, // 16:9
          },
          (decodedText: string, decodedResult: any) => {
            // Prevent duplicate scans
            if (scannedRef.current) return;
            scannedRef.current = true;
            
            console.log('Barcode detected:', decodedText);
            console.log('Barcode format:', decodedResult?.result?.format?.formatName);
            
            // Map html5-qrcode format to expo-camera format
            const formatMap: Record<string, string> = {
              'EAN_13': 'ean13',
              'EAN_8': 'ean8',
              'UPC_A': 'upc_a',
              'UPC_E': 'upc_e',
              'CODE_128': 'code128',
              'CODE_39': 'code39',
              'CODE_93': 'code93',
              'QR_CODE': 'qr',
            };
            
            const format = decodedResult?.result?.format?.formatName || 'unknown';
            const mappedFormat = formatMap[format] || format.toLowerCase();
            
            onBarcodeScanned({
              type: mappedFormat,
              data: decodedText
            });
          },
          (errorMessage: string) => {
            // This is called continuously when no barcode is detected
            // Only log errors that aren't "no barcode found"
            if (!errorMessage.includes('No MultiFormat Readers') && 
                !errorMessage.includes('No barcode') &&
                !errorMessage.includes('NotFoundException')) {
              console.warn('Scan error:', errorMessage);
            }
          }
        );
        
        setIsScanning(true);
        setIsInitializing(false);
        onPermissionGranted?.();
        
      } catch (err: any) {
        console.error('Error starting scanner:', err);
        
        let errorMsg = t('mealtype_log.scanner.camera_start_failed', 'Failed to start camera');
        let shouldSuggestFileUpload = false;
        
        if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission')) {
          errorMsg = t('mealtype_log.scanner.permission_denied', 'Camera permission denied. Please allow camera access in your browser settings.');
          shouldSuggestFileUpload = true;
        } else if (err?.name === 'NotFoundError') {
          errorMsg = t('mealtype_log.scanner.no_camera_found', 'No camera found on this device.');
          shouldSuggestFileUpload = true;
        } else if (err?.name === 'NotReadableError') {
          errorMsg = t('mealtype_log.scanner.camera_in_use', 'Camera is in use by another app.');
          shouldSuggestFileUpload = true;
        } else if (err?.message) {
          errorMsg = err.message;
          shouldSuggestFileUpload = true;
        }
        
        setError(errorMsg);
        setIsCameraError(shouldSuggestFileUpload);
        setIsInitializing(false);
        onError?.(errorMsg);
        
        // Notify parent that camera failed (for automatic fallback)
        if (shouldSuggestFileUpload && onCameraFailed) {
          onCameraFailed(errorMsg);
        }
      }
    };
    
    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(initScanner, 100);
    
    return () => {
      clearTimeout(timeoutId);
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
          scannerRef.current.clear();
        } catch (e) {
          // Ignore cleanup errors
        }
        scannerRef.current = null;
      }
      hasStartedRef.current = false;
      scannedRef.current = false;
    };
  }, [onBarcodeScanned, onPermissionGranted, onError, onCameraFailed, t]);

  if (Platform.OS !== 'web') {
    return null;
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        
        <View style={styles.errorButtonsContainer}>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.tint }]}
            onPress={() => {
              setError(null);
              setIsCameraError(false);
              setIsInitializing(true);
              hasStartedRef.current = false;
              scannedRef.current = false;
            }}
          >
            <Text style={styles.retryButtonText}>
              {t('mealtype_log.scanner.try_again', 'Try Again')}
            </Text>
          </TouchableOpacity>
          
          {isCameraError && onSwitchToFileUpload && (
            <TouchableOpacity
              style={[styles.uploadButton, { borderColor: colors.tint }]}
              onPress={onSwitchToFileUpload}
            >
              <Text style={[styles.uploadButtonText, { color: colors.tint }]}>
                {t('mealtype_log.scanner.upload_photo_instead', 'Upload Photo Instead')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isInitializing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Starting camera...
          </Text>
        </View>
      )}
      
      {/* This div will be used by html5-qrcode - needs absolute positioning and full size */}
      <div 
        id="web-barcode-scanner" 
        ref={containerRef as any}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          display: isInitializing ? 'none' : 'block',
        }} 
      />
      
      {isScanning && (
        <View style={styles.instructionContainer}>
          <View style={styles.instructionBubble}>
            <Text style={styles.instructionText}>
              {t('mealtype_log.scanner.point_at_barcode', 'Point your camera at a barcode')}
            </Text>
          </View>
          
          {onSwitchToFileUpload && (
            <TouchableOpacity
              style={styles.switchToUploadLink}
              onPress={onSwitchToFileUpload}
            >
              <Text style={styles.switchToUploadText}>
                {t('mealtype_log.scanner.or_upload_photo', 'or upload a photo')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 300,
  },
  errorButtonsContainer: {
    alignItems: 'center',
    gap: 12,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    minWidth: 140,
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 20,
  },
  instructionBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    maxWidth: '100%',
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  switchToUploadLink: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
  },
  switchToUploadText: {
    color: '#fff',
    fontSize: 14,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});

export default WebBarcodeScanner;

