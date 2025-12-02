import React, { useEffect, useRef, useState, useCallback } from "react";
import { Platform, View, Text, ActivityIndicator, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { validateAndNormalizeBarcode } from "@/lib/barcode";
import { getLocalDateString } from "@/utils/calculations";

type UniversalBarcodeScannerProps = {
  onDetected?: (code: string) => void; // Optional for backward compatibility
  // New props for self-contained flow
  mealType?: string;
  entryDate?: string;
  onClose?: () => void; // Callback to close the modal
};

type Mode = "loading" | "native" | "web";

export default function UniversalBarcodeScanner({ 
  onDetected,
  mealType,
  entryDate,
  onClose,
}: UniversalBarcodeScannerProps) {
  const [mode, setMode] = useState<Mode>("loading");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Decide platform mode and request native camera permission
  useEffect(() => {
    // Web
    if (Platform.OS === "web") {
      setMode("web");
      return;
    }

    // Native
    (async () => {
      try {
        const { status } = await CameraView.requestCameraPermissionsAsync();
        setHasPermission(status === "granted");
        setMode("native");
      } catch (e) {
        console.error("Error requesting camera permission", e);
        setHasPermission(false);
        setMode("native");
      }
    })();
  }, []);

  if (mode === "native") {
    if (hasPermission === null) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Requesting camera permission…</Text>
        </View>
      );
    }

    if (hasPermission === false) {
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
          <Text>No access to camera. Please enable camera permissions in system settings.</Text>
        </View>
      );
    }

    return <NativeScanner onDetected={onDetected} mealType={mealType} entryDate={entryDate} onClose={onClose} />;
  }

  if (mode === "web") {
    return <BarcodeScannerModal onDetected={onDetected} mealType={mealType} entryDate={entryDate} onClose={onClose} />;
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
      <Text style={{ marginTop: 8 }}>Loading scanner…</Text>
    </View>
  );
}

/**
 * Native scanner (Expo / iOS / Android) using expo-camera
 */
function NativeScanner({ 
  onDetected, 
  mealType, 
  entryDate, 
  onClose 
}: UniversalBarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    if (!permission) {
      requestPermission().catch((e) => console.error("Permission request failed", e));
    }
  }, [permission, requestPermission]);

  const handleDecodedBarcode = useCallback(async (barcode: string) => {
    const barcodeData = barcode?.trim();
    if (!barcodeData) {
      Alert.alert(
        t('alerts.error_title'),
        "No barcode detected. Please try again."
      );
      return;
    }

    try {
      // Validate and normalize the barcode
      const validationResult = validateAndNormalizeBarcode(barcodeData);

      if (!validationResult.isValid) {
        Alert.alert(
          t('scanned_item.invalid_barcode_title', 'Invalid Barcode'),
          validationResult.error || 'Invalid barcode format',
          [
            { 
              text: t('common.go_back', 'Go Back'), 
              style: 'cancel', 
              onPress: () => {
                onClose?.();
              }
            },
            {
              text: t('mealtype_log.scanner.try_again', 'Try Again'), 
              onPress: () => {
                setIsScanning(true);
              }
            }
          ]
        );
        return;
      }

      // Barcode is valid - close scanner and navigate to scanned-item page
      const normalizedCode = validationResult.normalizedCode!;
      
      // Close the scanner modal
      onClose?.();
      
      // Navigate to the scanned-item page with the normalized barcode
      router.push({
        pathname: '/scanned-item',
        params: {
          barcode: normalizedCode,
          mealType: mealType || 'breakfast',
          entryDate: entryDate || getLocalDateString(),
        },
      });
      
    } catch (error: any) {
      console.error('Barcode scan error:', error);
      Alert.alert(
        t('alerts.error_title'),
        error.message || t('common.unexpected_error'),
        [
          { text: t('common.go_back', 'Go Back'), style: 'cancel', onPress: () => {
            onClose?.();
          }},
          { 
            text: t('mealtype_log.scanner.try_again', 'Try Again'), 
            onPress: () => {
              setIsScanning(true);
            }
          }
        ]
      );
    }
  }, [router, mealType, entryDate, onClose, t]);

  const handleBarcodeScanned = useCallback(
    (result: any) => {
      if (!isScanning) return;

      const value = result?.data ?? result?.rawValue ?? "";

      if (!value) return;

      setIsScanning(false);
      
      // Use the common handler
      if (onDetected) {
        // Backward compatibility - call the callback
        onDetected(String(value));
      } else {
        // New flow - handle everything internally
        handleDecodedBarcode(String(value));
      }
    },
    [isScanning, onDetected, handleDecodedBarcode]
  );

  if (!permission) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
        <Text style={{ marginBottom: 8 }}>Camera permission is required to scan barcodes.</Text>
        <Text onPress={() => requestPermission()} style={{ textDecorationLine: "underline" }}>
          Tap here to grant permission
        </Text>
      </View>
    );
  }

  return (
    <CameraView
      style={{ flex: 1 }}
      barcodeScannerSettings={{
        barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
      }}
      onBarcodeScanned={handleBarcodeScanned}
    />
  );
}

/**
 * Barcode Scanner Modal - Unified web scanner with camera + file upload options
 * Simple, reliable implementation for mobile web browsers
 */
function BarcodeScannerModal({ 
  onDetected, 
  mealType, 
  entryDate, 
  onClose 
}: UniversalBarcodeScannerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"camera" | "upload">("camera");
  const [scanError, setScanError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const scannerRef = useRef<any | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const cameraContainerId = "barcode-scanner-container";

  // ============================================================================
  // Common "barcode detected" handler - used by both camera and upload flows
  // ============================================================================
  const handleDecodedBarcode = useCallback(async (barcode: string) => {
    const barcodeData = barcode?.trim();
    if (!barcodeData) {
      setScanError("No barcode detected. Please try again.");
      return;
    }

    setIsProcessing(true);
    setScanError(null);

    try {
      // If onDetected callback is provided (backward compatibility), use it
      if (onDetected) {
        onDetected(barcodeData);
        setIsProcessing(false);
        return;
      }

      // New flow: handle everything internally
      // Validate and normalize the barcode
      const validationResult = validateAndNormalizeBarcode(barcodeData);

      if (!validationResult.isValid) {
        // Invalid barcode format - show error with options
        Alert.alert(
          t('scanned_item.invalid_barcode_title', 'Invalid Barcode'),
          validationResult.error || 'Invalid barcode format',
          [
            { 
              text: t('common.go_back', 'Go Back'), 
              style: 'cancel', 
              onPress: () => {
                onClose?.();
              }
            },
            {
              text: t('mealtype_log.scanner.try_again', 'Try Again'), 
              onPress: () => {
                setScanError(null);
                setIsProcessing(false);
              }
            }
          ]
        );
        return;
      }

      // Barcode is valid - close scanner and navigate to scanned-item page
      const normalizedCode = validationResult.normalizedCode!;
      
      // Close the scanner modal
      onClose?.();
      
      // Navigate to the scanned-item page with the normalized barcode
      router.push({
        pathname: '/scanned-item',
        params: {
          barcode: normalizedCode,
          mealType: mealType || 'breakfast',
          entryDate: entryDate || getLocalDateString(),
        },
      });
      
    } catch (error: any) {
      console.error('Barcode scan error:', error);
      Alert.alert(
        t('alerts.error_title'),
        error.message || t('common.unexpected_error'),
        [
          { text: t('common.go_back', 'Go Back'), style: 'cancel', onPress: () => {
            onClose?.();
          }},
          { 
            text: t('mealtype_log.scanner.try_again', 'Try Again'), 
            onPress: () => {
              setScanError(null);
              setIsProcessing(false);
            }
          }
        ]
      );
    } finally {
      setIsProcessing(false);
    }
  }, [onDetected, router, mealType, entryDate, onClose, t]);

  // ============================================================================
  // Camera helpers
  // ============================================================================
  const stopCamera = useCallback(async () => {
    if (!scannerRef.current || !isCameraActive) return;
    
    try {
      await scannerRef.current.stop();
      await scannerRef.current.clear();
    } catch (err) {
      console.warn("Error stopping camera", err);
    } finally {
      setIsCameraActive(false);
    }
  }, [isCameraActive]);

  const onScanSuccess = useCallback((decodedText: string) => {
    if (!decodedText) return;
    
    // Stop camera and handle the barcode
    stopCamera();
    handleDecodedBarcode(decodedText);
  }, [stopCamera, handleDecodedBarcode]);

  const onScanFailure = useCallback((error: any) => {
    // Ignore per-frame failures - this is called continuously when no barcode is detected
  }, []);

  // ============================================================================
  // Camera lifecycle - start when camera tab is active
  // ============================================================================
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (activeTab !== "camera") {
      stopCamera();
      return;
    }

    let isMounted = true;

    const startCamera = async () => {
      if (isCameraActive) return;

      try {
        setScanError(null);

        // Load html5-qrcode library
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

        // Ensure container exists and is visible
        const container = document.getElementById(cameraContainerId);
        if (!container) {
          throw new Error("Scanner container not found");
        }

        // Make container visible with fixed dimensions (required for mobile)
        container.style.display = "block";
        container.style.width = "100%";
        container.style.height = "300px";
        container.style.backgroundColor = "#000";

        // Configure scanner for product barcodes
        const formatsToSupport = Html5QrcodeSupportedFormats ? [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ].filter(Boolean) : undefined;

        const config: any = {
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        };

        if (formatsToSupport) {
          config.formatsToSupport = formatsToSupport;
        }

        // Create scanner instance if needed
        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(cameraContainerId, config);
        }

        // Small delay to ensure container is rendered
        await new Promise(resolve => setTimeout(resolve, 100));

        // Start camera
        await scannerRef.current.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 300, height: 200 },
          },
          onScanSuccess,
          onScanFailure
        );

        if (isMounted) {
          setIsCameraActive(true);
        }
      } catch (err: any) {
        console.error("Failed to start camera", err);
        
        if (!isMounted) return;

        let errorMsg = "Unable to start camera. On mobile, use HTTPS and allow camera access, or switch to Upload Photo.";
        if (err?.name === "NotAllowedError") {
          errorMsg = "Camera permission denied. Please allow camera access in your browser settings, or switch to Upload Photo.";
        } else if (err?.name === "NotFoundError") {
          errorMsg = "No camera found on this device. Please use Upload Photo instead.";
        } else if (err?.name === "NotReadableError") {
          errorMsg = "Camera is in use by another app. Please close other apps using the camera, or switch to Upload Photo.";
        }

        setScanError(errorMsg);
        setIsCameraActive(false);
      }
    };

    // Start camera after a short delay
    const timeoutId = setTimeout(() => {
      startCamera();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      stopCamera();
    };
  }, [activeTab, isCameraActive, onScanSuccess, onScanFailure, stopCamera]);

  // ============================================================================
  // Upload Photo handler
  // ============================================================================
  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanError(null);
    setIsProcessing(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      // Create temporary scanner for file decoding
      const html5QrCode = new Html5Qrcode("html5-qrcode-web-file");

      // Decode barcode from image
      const result: any = await html5QrCode.scanFile(file, true);

      // Clean up
      try {
        html5QrCode.clear();
      } catch (cleanupErr) {
        // Ignore cleanup errors
      }

      const decoded = result?.decodedText ?? result;

      if (decoded) {
        // Use the same handler as camera
        await handleDecodedBarcode(String(decoded));
      } else {
        setScanError("Unable to read barcode from this image. Try a clearer, well-lit photo.");
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error("File upload scan error", err);
      setScanError("Unable to read barcode from this image. Try a clearer, well-lit photo.");
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: "#fff" }}>
      {/* Tab buttons */}
      <View style={{ flexDirection: "row", marginBottom: 12, gap: 8 }}>
        <button
          type="button"
          onClick={() => setActiveTab("camera")}
          style={{
            padding: "8px 16px",
            borderRadius: 4,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: activeTab === "camera" ? "#007AFF" : "#ccc",
            backgroundColor: activeTab === "camera" ? "#007AFF" : "#fff",
            color: activeTab === "camera" ? "#fff" : "#000",
            fontWeight: activeTab === "camera" ? "bold" : "normal",
            cursor: "pointer",
          }}
        >
          Use Camera
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          style={{
            padding: "8px 16px",
            borderRadius: 4,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: activeTab === "upload" ? "#007AFF" : "#ccc",
            backgroundColor: activeTab === "upload" ? "#007AFF" : "#fff",
            color: activeTab === "upload" ? "#fff" : "#000",
            fontWeight: activeTab === "upload" ? "bold" : "normal",
            cursor: "pointer",
          }}
        >
          Upload Photo
        </button>
      </View>

      {/* Error message */}
      {scanError && (
        <View style={{ marginBottom: 12, padding: 12, backgroundColor: "#ffebee", borderRadius: 4 }}>
          <Text style={{ color: "#c62828" }}>{scanError}</Text>
        </View>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <View style={{ alignItems: "center", justifyContent: "center", marginBottom: 12, padding: 16 }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Processing barcode...</Text>
        </View>
      )}

      {/* Camera view */}
      {activeTab === "camera" && (
        <>
          <div 
            id={cameraContainerId} 
            style={{ 
              width: "100%", 
              height: 300,
              backgroundColor: "#000",
              overflow: "hidden",
            }} 
          />
          {/* CSS to ensure video fills container */}
          <style dangerouslySetInnerHTML={{ __html: `
            #${cameraContainerId} {
              width: 100% !important;
              height: 300px !important;
              position: relative !important;
              background-color: #000 !important;
            }
            #${cameraContainerId} video {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
              display: block !important;
            }
          `}} />
        </>
      )}

      {/* Upload Photo view */}
      {activeTab === "upload" && (
        <View>
          <Text style={{ marginBottom: 8, fontSize: 16 }}>Upload a photo of a barcode to scan:</Text>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileChange}
            disabled={isProcessing}
            style={{
              padding: "8px",
              fontSize: 16,
              border: "1px solid #ccc",
              borderRadius: 4,
              width: "100%",
              maxWidth: 400,
            }}
          />
          <div id="html5-qrcode-web-file" style={{ display: "none" }} />
        </View>
      )}
    </View>
  );
}
