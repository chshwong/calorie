import React, { useEffect, useRef, useState, useCallback } from "react";
import { Platform, View, Text, ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, Dimensions, TextInput } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { validateAndNormalizeBarcode } from "@/lib/barcode";
import { getLocalDateString } from "@/utils/calculations";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const screenWidth = Dimensions.get('window').width;
  const isDesktop = Platform.OS === 'web' && screenWidth > 768;
  
  // Platform detection (web only)
  const isWeb = typeof window !== "undefined";
  const isMobileWeb = isWeb && /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
  const isDesktopWeb = isWeb && !isMobileWeb;
  
  const [activeTab, setActiveTab] = useState<"camera" | "upload">(isMobileWeb ? "camera" : "upload");
  const [scanError, setScanError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  
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
  // Manual barcode entry handler
  // ============================================================================
  const handleManualSearch = useCallback(async () => {
    const trimmedBarcode = manualBarcode.trim();
    if (!trimmedBarcode) {
      setScanError("Please enter a barcode.");
      return;
    }
    
    // Clear manual input and use the shared handler
    setManualBarcode("");
    await handleDecodedBarcode(trimmedBarcode);
  }, [manualBarcode, handleDecodedBarcode]);

  // ============================================================================
  // Camera lifecycle - start when camera tab is active (mobile web only)
  // ============================================================================
  useEffect(() => {
    if (Platform.OS !== "web") return;
    
    // Only start camera on mobile web
    if (!isMobileWeb) {
      stopCamera();
      return;
    }
    
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
        container.style.backgroundColor = "#000";
        
        // Calculate height based on width and 3:4 aspect ratio for better responsiveness
        // Try to get width immediately, fallback to 300px if not available yet
        let containerWidth = container.offsetWidth;
        if (!containerWidth || containerWidth === 0) {
          // Container might not be laid out yet, use a reasonable default
          containerWidth = 300;
          // Update height after a short delay when container is laid out
          setTimeout(() => {
            const actualWidth = container.offsetWidth || containerWidth;
            const calculatedHeight = Math.round(actualWidth * (4 / 3));
            container.style.height = `${calculatedHeight}px`;
          }, 50);
        }
        const calculatedHeight = Math.round(containerWidth * (4 / 3));
        container.style.height = `${calculatedHeight}px`;

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
  }, [activeTab, isCameraActive, isMobileWeb, onScanSuccess, onScanFailure, stopCamera]);

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
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.cardContainer, { maxWidth: isDesktop ? 420 : '100%' }]}>
          <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
            {/* Title */}
            <ThemedText 
              type="title" 
              style={[styles.title, { color: colors.text }]}
            >
              {t('mealtype_log.scanner.title', 'Scan Barcode')}
            </ThemedText>

            {/* Mobile Web: Segmented Control (Camera / Upload Photo) */}
            {isMobileWeb && (
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    styles.segmentButtonLeft,
                    { 
                      borderColor: activeTab === "camera" ? colors.tint : colors.border,
                      backgroundColor: activeTab === "camera" ? colors.tint : 'transparent',
                    },
                  ]}
                  onPress={() => setActiveTab("camera")}
                  activeOpacity={0.7}
                >
                  <ThemedText 
                    style={[
                      styles.segmentButtonText,
                      { color: activeTab === "camera" ? "#fff" : colors.text },
                    ]}
                  >
                    {t('mealtype_log.scanner.use_camera', 'Use Camera')}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    styles.segmentButtonRight,
                    { 
                      borderColor: activeTab === "upload" ? colors.tint : colors.border,
                      backgroundColor: activeTab === "upload" ? colors.tint : 'transparent',
                    },
                  ]}
                  onPress={() => setActiveTab("upload")}
                  activeOpacity={0.7}
                >
                  <ThemedText 
                    style={[
                      styles.segmentButtonText,
                      { color: activeTab === "upload" ? "#fff" : colors.text },
                    ]}
                  >
                    {t('mealtype_log.scanner.upload_photo', 'Upload Photo')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}

            {/* Desktop Web: Upload Photo Button Only */}
            {isDesktopWeb && (
              <View style={styles.uploadButtonContainer}>
                <TouchableOpacity
                  style={[
                    styles.uploadButton,
                    { 
                      backgroundColor: colors.tint,
                      opacity: isProcessing ? 0.6 : 1,
                    },
                  ]}
                  onPress={() => {
                    // Trigger file input click
                    const fileInput = document.getElementById('barcode-file-input-desktop') as HTMLInputElement;
                    fileInput?.click();
                  }}
                  disabled={isProcessing}
                  activeOpacity={0.7}
                >
                  <ThemedText style={[styles.uploadButtonText, { color: "#fff" }]}>
                    {t('mealtype_log.scanner.upload_photo', 'Upload Photo')}
                  </ThemedText>
                </TouchableOpacity>
                <input 
                  id="barcode-file-input-desktop"
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  disabled={isProcessing}
                  style={{ display: "none" }}
                />
                <div id="html5-qrcode-web-file" style={{ display: "none" }} />
              </View>
            )}

            {/* Error message */}
            {scanError && (
              <View 
                style={[
                  styles.errorContainer, 
                  { 
                    backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                    borderColor: '#EF4444' 
                  }
                ]}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                {...(Platform.OS === 'web' ? { role: 'alert', 'aria-live': 'polite' as const } : {})}
              >
                <IconSymbol name="info.circle.fill" size={18} color="#EF4444" />
                <ThemedText style={[styles.errorText, { color: '#EF4444' }]}>
                  {scanError}
                </ThemedText>
              </View>
            )}

            {/* Processing indicator */}
            {isProcessing && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="small" color={colors.tint} />
                <ThemedText style={[styles.processingText, { color: colors.textSecondary }]}>
                  {t('mealtype_log.scanner.processing', 'Processing barcode...')}
                </ThemedText>
              </View>
            )}

            {/* Mobile Web: Camera view */}
            {isMobileWeb && activeTab === "camera" && (
              <View style={styles.cameraSection}>
                <View style={styles.cameraWrapper}>
                  <div 
                    id={cameraContainerId} 
                    style={{ 
                      width: "100%", 
                      backgroundColor: "#000",
                      borderRadius: 12,
                      overflow: "hidden",
                    }} 
                  />
                  {/* CSS to ensure video fills container */}
                  <style dangerouslySetInnerHTML={{ __html: `
                    #${cameraContainerId} {
                      width: 100% !important;
                      position: relative !important;
                      background-color: #000 !important;
                      border-radius: 12px !important;
                      overflow: hidden !important;
                    }
                    #${cameraContainerId} video {
                      width: 100% !important;
                      height: 100% !important;
                      object-fit: cover !important;
                      display: block !important;
                      position: absolute !important;
                      top: 0 !important;
                      left: 0 !important;
                    }
                    #${cameraContainerId} > div {
                      width: 100% !important;
                      height: 100% !important;
                      position: relative !important;
                    }
                    #${cameraContainerId} canvas {
                      display: none !important;
                    }
                  `}} />
                </View>
                <ThemedText style={[styles.helperText, { color: colors.textSecondary }]}>
                  {t('mealtype_log.scanner.helper_text', 'Align the barcode inside the frame to scan.')}
                </ThemedText>
              </View>
            )}

            {/* Mobile Web: Upload Photo view */}
            {isMobileWeb && activeTab === "upload" && (
              <View style={styles.uploadSection}>
                <ThemedText style={[styles.uploadLabel, { color: colors.text }]}>
                  {t('mealtype_log.scanner.upload_label', 'Upload a photo of a barcode to scan:')}
                </ThemedText>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  disabled={isProcessing}
                  style={{
                    padding: "12px",
                    fontSize: 16,
                    border: `1.5px solid ${colors.border}`,
                    borderRadius: 12,
                    width: "100%",
                    backgroundColor: colors.backgroundSecondary,
                    color: colors.text,
                    cursor: isProcessing ? "not-allowed" : "pointer",
                    opacity: isProcessing ? 0.6 : 1,
                  }}
                />
                <div id="html5-qrcode-web-file" style={{ display: "none" }} />
              </View>
            )}

            {/* Manual Barcode Entry (always visible on both desktop and mobile web) */}
            <View style={[styles.manualEntrySection, { borderTopColor: colors.border }]}>
              <View style={styles.manualEntryDivider}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <ThemedText style={[styles.dividerText, { color: colors.textSecondary }]}>
                  {t('common.or', 'or')}
                </ThemedText>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>
              
              <ThemedText style={[styles.manualEntryLabel, { color: colors.text }]}>
                {t('mealtype_log.scanner.manual_entry_label', 'Enter barcode manually:')}
              </ThemedText>
              
              <View style={styles.manualEntryRow}>
                <TextInput
                  style={[
                    styles.manualEntryInput,
                    {
                      borderColor: colors.border,
                      color: colors.text,
                      backgroundColor: colors.backgroundSecondary,
                      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
                    },
                  ]}
                  placeholder={t('mealtype_log.scanner.manual_entry_placeholder', 'Enter barcode number')}
                  placeholderTextColor={colors.textSecondary}
                  value={manualBarcode}
                  onChangeText={(text) => {
                    setManualBarcode(text);
                    setScanError(null);
                  }}
                  onSubmitEditing={handleManualSearch}
                  returnKeyType="search"
                  keyboardType="numeric"
                  autoCapitalize="none"
                  editable={!isProcessing}
                />
                <TouchableOpacity
                  style={[
                    styles.manualEntryButton,
                    { 
                      backgroundColor: isProcessing || !manualBarcode.trim() ? colors.textSecondary : colors.tint,
                      opacity: isProcessing || !manualBarcode.trim() ? 0.6 : 1,
                    },
                  ]}
                  onPress={handleManualSearch}
                  disabled={isProcessing || !manualBarcode.trim()}
                  activeOpacity={0.7}
                >
                  <ThemedText style={[styles.manualEntryButtonText, { color: "#fff" }]}>
                    {t('common.search', 'Search')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    minHeight: '100%',
  },
  cardContainer: {
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 8,
      },
    }),
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 0,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    backgroundColor: 'transparent',
  },
  segmentButtonLeft: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderRightWidth: 0,
  },
  segmentButtonRight: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderLeftWidth: 0,
  },
  segmentButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    marginBottom: 20,
  },
  processingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cameraSection: {
    marginTop: 8,
  },
  cameraWrapper: {
    width: '100%',
    marginBottom: 12,
  },
  helperText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  uploadSection: {
    marginTop: 8,
  },
  uploadLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 12,
    lineHeight: 22,
  },
  uploadButtonContainer: {
    marginBottom: 24,
  },
  uploadButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  manualEntrySection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
  },
  manualEntryDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  manualEntryLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 12,
    lineHeight: 22,
  },
  manualEntryRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  manualEntryInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 52,
  },
  manualEntryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 100,
  },
  manualEntryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
