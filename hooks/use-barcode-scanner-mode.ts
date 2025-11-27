import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

export type BarcodeScannerMode = 'camera' | 'file-upload' | 'checking';

export type BarcodeScannerModeResult = {
  /** Current scanner mode: 'camera', 'file-upload', or 'checking' while detecting */
  mode: BarcodeScannerMode;
  /** Whether we're still checking capabilities */
  isChecking: boolean;
  /** Whether camera is available (web only - always true on native) */
  cameraAvailable: boolean;
  /** Error message if camera check failed */
  error: string | null;
  /** Force switch to file upload mode (useful if camera fails at runtime) */
  switchToFileUpload: () => void;
  /** Re-check camera availability */
  recheckCamera: () => Promise<void>;
};

/**
 * Hook to detect the best barcode scanning mode for the current platform.
 * 
 * On native (iOS/Android): Always returns 'camera' mode.
 * On web: Checks if camera is available and returns 'camera' or 'file-upload'.
 * 
 * Usage:
 * ```tsx
 * const { mode, isChecking, switchToFileUpload } = useBarcodeScannerMode();
 * 
 * if (isChecking) return <Loading />;
 * if (mode === 'camera') return <CameraScanner />;
 * if (mode === 'file-upload') return <FileUploadScanner />;
 * ```
 */
export function useBarcodeScannerMode(): BarcodeScannerModeResult {
  const [mode, setMode] = useState<BarcodeScannerMode>(
    Platform.OS === 'web' ? 'checking' : 'camera'
  );
  const [cameraAvailable, setCameraAvailable] = useState(Platform.OS !== 'web');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(Platform.OS === 'web');

  const checkCameraAvailability = useCallback(async () => {
    // Native platforms always have camera capability
    if (Platform.OS !== 'web') {
      setMode('camera');
      setCameraAvailable(true);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        console.log('[BarcodeScannerMode] Not in browser environment');
        setMode('file-upload');
        setCameraAvailable(false);
        setIsChecking(false);
        return;
      }

      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.log('[BarcodeScannerMode] getUserMedia not supported');
        setMode('file-upload');
        setCameraAvailable(false);
        setIsChecking(false);
        return;
      }

      // Check if we're in a secure context (HTTPS or localhost)
      if (window.isSecureContext === false) {
        console.log('[BarcodeScannerMode] Not a secure context - camera requires HTTPS');
        setError('Camera requires a secure connection (HTTPS)');
        setMode('file-upload');
        setCameraAvailable(false);
        setIsChecking(false);
        return;
      }

      // Try to enumerate devices to check if a camera exists
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length === 0) {
        console.log('[BarcodeScannerMode] No camera devices found');
        setMode('file-upload');
        setCameraAvailable(false);
        setIsChecking(false);
        return;
      }

      // Check permission status if the API is available
      if (navigator.permissions?.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ 
            name: 'camera' as PermissionName 
          });
          
          if (permissionStatus.state === 'denied') {
            console.log('[BarcodeScannerMode] Camera permission denied');
            setError('Camera permission was denied. You can upload a photo instead.');
            setMode('file-upload');
            setCameraAvailable(false);
            setIsChecking(false);
            return;
          }
          
          // Permission is 'granted' or 'prompt' - camera is available
          console.log('[BarcodeScannerMode] Camera available, permission:', permissionStatus.state);
          setMode('camera');
          setCameraAvailable(true);
          setIsChecking(false);
          return;
        } catch (permErr) {
          // Permission query failed (not supported in all browsers)
          console.log('[BarcodeScannerMode] Permission query not supported, assuming camera available');
        }
      }

      // If we got here, camera should be available
      console.log('[BarcodeScannerMode] Camera appears available');
      setMode('camera');
      setCameraAvailable(true);
      setIsChecking(false);

    } catch (err: any) {
      console.error('[BarcodeScannerMode] Error checking camera:', err);
      setError(err?.message || 'Failed to check camera availability');
      setMode('file-upload');
      setCameraAvailable(false);
      setIsChecking(false);
    }
  }, []);

  // Check camera availability on mount (web only)
  useEffect(() => {
    if (Platform.OS === 'web') {
      checkCameraAvailability();
    }
  }, [checkCameraAvailability]);

  const switchToFileUpload = useCallback(() => {
    console.log('[BarcodeScannerMode] Manually switching to file upload');
    setMode('file-upload');
    setCameraAvailable(false);
  }, []);

  const recheckCamera = useCallback(async () => {
    await checkCameraAvailability();
  }, [checkCameraAvailability]);

  return {
    mode,
    isChecking,
    cameraAvailable,
    error,
    switchToFileUpload,
    recheckCamera,
  };
}

export default useBarcodeScannerMode;

