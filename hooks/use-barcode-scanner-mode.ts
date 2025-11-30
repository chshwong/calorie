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
  // Helper to detect mobile - safe to call at any time
  const detectMobile = () => {
    if (Platform.OS !== 'web') return false;
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };
  
  // On mobile web, start with camera mode (optimistic) instead of checking
  // This gives better UX - camera appears immediately, then falls back if needed
  const isMobileWeb = detectMobile();
  const [mode, setMode] = useState<BarcodeScannerMode>(() => {
    if (Platform.OS !== 'web') return 'camera';
    // On mobile web, default to camera immediately
    if (isMobileWeb) return 'camera';
    // On desktop web, start with checking
    return 'checking';
  });
  const [cameraAvailable, setCameraAvailable] = useState(() => {
    // Assume camera available on native or mobile web
    return Platform.OS !== 'web' || isMobileWeb;
  });
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(() => {
    // Only show checking state on desktop web
    return Platform.OS === 'web' && !isMobileWeb;
  });

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
        // Default to camera - let the camera component handle the error
        setMode('camera');
        setCameraAvailable(true);
        setIsChecking(false);
        return;
      }

      // Detect if we're on a mobile device FIRST - this affects how we handle checks
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // No mediaDevices API - on mobile, still try camera (component will handle error)
        if (isMobile) {
          setMode('camera');
          setCameraAvailable(true);
          setIsChecking(false);
          return;
        }
        // On desktop, fallback to file upload
        setMode('file-upload');
        setCameraAvailable(false);
        setIsChecking(false);
        return;
      }

      // Check if we're in a secure context (HTTPS or localhost)
      // On mobile, be more lenient - IP addresses might work in some browsers
      if (window.isSecureContext === false) {
        if (isMobile) {
          // On mobile, still try camera - some mobile browsers allow camera on local IPs
          // The camera component will handle the actual error if it fails
          console.log('[BarcodeScannerMode] Not secure context on mobile, but will try camera anyway');
          setMode('camera');
          setCameraAvailable(true);
          setIsChecking(false);
          return;
        }
        // On desktop, require secure context
        setError('Camera requires a secure connection (HTTPS)');
        setMode('file-upload');
        setCameraAvailable(false);
        setIsChecking(false);
        return;
      }

      // On mobile devices, be more optimistic - default to camera and let it try
      // enumerateDevices() often requires permission first on mobile, so it may fail
      if (isMobile) {
        // On mobile, ALWAYS use camera mode - never set to file-upload here
        // The camera component will handle permission requests and errors gracefully
        // If camera truly fails, the component can show file upload as fallback
        
        // Quick permission check (non-blocking, don't wait long)
        try {
          if (navigator.permissions?.query) {
            // Try to check permission, but don't wait long or block on it
            const permissionPromise = navigator.permissions.query({ 
              name: 'camera' as PermissionName 
            });
            
            // Use a very short timeout so we don't block
            const timeoutPromise = new Promise((resolve) => 
              setTimeout(() => resolve(null), 50)
            );
            
            const permissionStatus = await Promise.race([permissionPromise, timeoutPromise]) as any;
            
            // Log permission state but don't act on it - always try camera
            if (permissionStatus?.state === 'denied') {
              console.log('[BarcodeScannerMode] Camera permission denied, but will still try camera on mobile');
            }
          }
        } catch (permErr) {
          // Permission query not supported or failed - that's okay, try camera anyway
          console.log('[BarcodeScannerMode] Could not check permission, will try camera on mobile');
        }
        
        // CRITICAL: On mobile, ALWAYS set to camera mode - never file-upload
        // The WebBarcodeScanner component will handle actual camera errors
        setMode('camera');
        setCameraAvailable(true);
        setIsChecking(false);
        return;
      }

      // On desktop, try to enumerate devices first
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
          setMode('file-upload');
          setCameraAvailable(false);
          setIsChecking(false);
          return;
        }
      } catch (enumErr) {
        // enumerateDevices might fail without permission - that's okay, try camera anyway
        console.log('[BarcodeScannerMode] Could not enumerate devices, will try camera anyway');
      }

      // Check permission status if the API is available
      if (navigator.permissions?.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ 
            name: 'camera' as PermissionName 
          });
          
          if (permissionStatus.state === 'denied') {
            setError('Camera permission was denied. You can upload a photo instead.');
            setMode('file-upload');
            setCameraAvailable(false);
            setIsChecking(false);
            return;
          }
          
          // Permission is 'granted' or 'prompt' - camera is available
          setMode('camera');
          setCameraAvailable(true);
          setIsChecking(false);
          return;
        } catch (permErr) {
          // Permission query failed (not supported in all browsers)
          // Assume camera is available and try it
        }
      }

      // If we got here, default to camera mode - let the camera component handle errors
      setMode('camera');
      setCameraAvailable(true);
      setIsChecking(false);

    } catch (err: any) {
      console.error('[BarcodeScannerMode] Error checking camera:', err);
      // On error, default to camera mode and let the camera component handle the error
      // This is better UX - try camera first, fallback to file upload only if camera actually fails
      setError(err?.message || 'Failed to check camera availability');
      setMode('camera');
      setCameraAvailable(true); // Assume available, let camera component handle errors
      setIsChecking(false);
    }
  }, []);

  // Check camera availability on mount (web only)
  useEffect(() => {
    if (Platform.OS === 'web') {
      // On mobile web, we already defaulted to camera mode
      // Still run the check to update cameraAvailable, but it shouldn't change mode
      const wasMobile = detectMobile();
      if (wasMobile) {
        // On mobile, run a quick check but don't let it change mode to file-upload
        checkCameraAvailability().catch(() => {
          // Even if check fails, keep camera mode on mobile
          console.log('[BarcodeScannerMode] Check failed on mobile, keeping camera mode');
        });
      } else {
        // On desktop, run full check
        checkCameraAvailability();
      }
    }
  }, [checkCameraAvailability]);

  const switchToFileUpload = useCallback(() => {
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

