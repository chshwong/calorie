import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

// Load html5-qrcode from CDN to avoid Metro bundler issues
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
  const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        
        // Check if element exists and is visible
        const scannerElement = document.getElementById(scannerId);
        if (!scannerElement) {
          console.error('Scanner element not found');
          setError(t('mealtype_log.scanner.element_not_found', 'Scanner element not found'));
          setIsInitializing(false);
          return;
        }
        
        // Ensure element is visible (required for camera on some mobile browsers)
        const elementStyle = window.getComputedStyle(scannerElement);
        if (elementStyle.display === 'none' || elementStyle.visibility === 'hidden') {
          console.warn('Scanner element is hidden, making it visible');
          scannerElement.style.display = 'block';
          scannerElement.style.visibility = 'visible';
        }
        
        // Get supported formats - prioritize product barcodes (EAN-13, UPC-A)
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

        // Create scanner instance with explicit format configuration
        const scannerConfig: any = {
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true // Use native BarcodeDetector API if available
          }
        };
        
        if (formatsToSupport) {
          scannerConfig.formatsToSupport = formatsToSupport;
        }

        scannerRef.current = new Html5Qrcode(scannerId, scannerConfig);
        
        // Wrap camera start in a timeout using Promise.race
        // This ensures we timeout even if start() hangs indefinitely
        const startCamera = () => {
          return scannerRef.current.start(
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
              // Silently ignore "no barcode found" errors
            }
          );
        };
        
        // Create a timeout promise that will reject after 8 seconds
        // Also set a direct timeout to update UI immediately if needed
        let timeoutFired = false;
        const timeoutPromise = new Promise((_, reject) => {
          startTimeoutRef.current = setTimeout(() => {
            if (process.env.NODE_ENV !== 'production') {
              console.error('[WebBarcodeScanner] Camera start timeout after 8 seconds');
            }
            timeoutFired = true;
            reject(new Error('Camera start timed out after 8 seconds'));
          }, 8000); // 8 second timeout
        });
        
        // Also set a direct timeout as backup to FORCE update UI after 8 seconds
        // This will work even if Promise.race fails or hangs
        uiTimeoutRef.current = setTimeout(() => {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[WebBarcodeScanner] FORCE timeout - directly updating UI after 8 seconds');
          }
          // Force update state directly - this bypasses any promise issues
          const timeoutError = 'Camera start timed out. Please try again or use file upload.';
          setError(t('mealtype_log.scanner.camera_timeout', timeoutError));
          setIsCameraError(true);
          setIsInitializing(false);
          onError?.(timeoutError);
          if (onCameraFailed) {
            onCameraFailed(timeoutError);
          }
          // Try to clean up the scanner
          if (scannerRef.current) {
            try {
              scannerRef.current.stop().catch(() => {});
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        }, 8000);
        
        try {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[WebBarcodeScanner] Starting camera with 8 second timeout...');
          }
          // Race between camera start and timeout
          await Promise.race([startCamera(), timeoutPromise]);
          
          // Clear timeout if we got here successfully
          if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
            startTimeoutRef.current = null;
          }
          if (uiTimeoutRef.current) {
            clearTimeout(uiTimeoutRef.current);
            uiTimeoutRef.current = null;
          }
          
          if (process.env.NODE_ENV !== 'production') {
            console.log('[WebBarcodeScanner] Camera started successfully');
          }
          setIsScanning(true);
          setIsInitializing(false);
          onPermissionGranted?.();
        } catch (startError: any) {
          // Clear timeouts since we're handling the error
          if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
            startTimeoutRef.current = null;
          }
          if (uiTimeoutRef.current) {
            clearTimeout(uiTimeoutRef.current);
            uiTimeoutRef.current = null;
          }
          
          if (process.env.NODE_ENV !== 'production') {
            console.error('[WebBarcodeScanner] Camera start error:', startError);
          }
          
          // Check if it's a timeout error
          if (startError?.message?.includes('timed out') || timeoutFired) {
            if (process.env.NODE_ENV !== 'production') {
              console.error('[WebBarcodeScanner] Camera start timeout detected');
            }
            // Try to clean up the scanner
            if (scannerRef.current) {
              try {
                scannerRef.current.stop().catch(() => {});
              } catch (e) {
                // Ignore cleanup errors
              }
            }
            throw new Error('Camera start timed out. Please try again or use file upload.');
          }
          
          throw startError; // Re-throw other errors to be caught by outer catch
        }
        
      } catch (err: any) {
        console.error('Error starting scanner:', err);
        
        let errorMsg = t('mealtype_log.scanner.camera_start_failed', 'Failed to start camera');
        let shouldSuggestFileUpload = false;
        
        // Check for timeout first
        if (err?.message?.includes('timed out') || err?.message?.includes('timeout')) {
          errorMsg = t('mealtype_log.scanner.camera_timeout', 'Camera start timed out. Please try again or use file upload.');
          shouldSuggestFileUpload = true;
        } else if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission')) {
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
    
    // Small delay to ensure DOM is ready, but check if element exists first
    const timeoutId = setTimeout(() => {
      // Double-check element exists before starting
      const scannerElement = document.getElementById('web-barcode-scanner');
      if (!scannerElement) {
        console.error('Scanner element still not found after delay');
        setError(t('mealtype_log.scanner.element_not_found', 'Scanner element not found'));
        setIsInitializing(false);
        return;
      }
      initScanner();
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
      if (uiTimeoutRef.current) {
        clearTimeout(uiTimeoutRef.current);
        uiTimeoutRef.current = null;
      }
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
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: '400px',
      backgroundColor: '#000',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {isInitializing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Starting camera...
          </Text>
        </View>
      )}
      
      {/* This div will be used by html5-qrcode */}
      <div 
        id="web-barcode-scanner" 
        ref={containerRef as any}
        style={{ 
          flex: 1,
          width: '100%',
          minHeight: '300px',
          display: isInitializing ? 'none' : 'block',
        }} 
      />
      
      {/* CSS to ensure html5-qrcode video fills container */}
      <style dangerouslySetInnerHTML={{ __html: `
        #web-barcode-scanner video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        #web-barcode-scanner > div {
          width: 100% !important;
          height: 100% !important;
        }
      `}} />
      
      {isScanning && (
        <div style={{
          position: 'absolute',
          bottom: 40,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 100,
        }}>
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: '12px 20px',
            borderRadius: 12,
          }}>
            <span style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}>
              {t('mealtype_log.scanner.point_at_barcode', 'Point your camera at a barcode')}
            </span>
          </div>
          
          {onSwitchToFileUpload && (
            <button
              onClick={onSwitchToFileUpload}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <span style={{
                color: '#fff',
                fontSize: 14,
                textDecoration: 'underline',
              }}>
                {t('mealtype_log.scanner.or_upload_photo', 'or upload a photo')}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
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
});

export default WebBarcodeScanner;

