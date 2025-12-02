import React, { useEffect, useRef, useState, useCallback } from "react";
import { Platform, View, Text, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

type UniversalBarcodeScannerProps = {
  onDetected: (code: string) => void;
};

type Mode = "loading" | "native" | "web";

export default function UniversalBarcodeScanner({ onDetected }: UniversalBarcodeScannerProps) {
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

    return <NativeScanner onDetected={onDetected} />;
  }

  if (mode === "web") {
    return <BarcodeScannerModal onDetected={onDetected} />;
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
function NativeScanner({ onDetected }: UniversalBarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    if (!permission) {
      requestPermission().catch((e) => console.error("Permission request failed", e));
    }
  }, [permission, requestPermission]);

  const handleBarcodeScanned = useCallback(
    (result: any) => {
      if (!isScanning) return;

      const value = result?.data ?? result?.rawValue ?? "";

      if (!value) return;

      setIsScanning(false);
      onDetected(String(value));
    },
    [isScanning, onDetected]
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
 * This component handles both camera scanning and file upload for barcode detection.
 */
function BarcodeScannerModal({ onDetected }: UniversalBarcodeScannerProps) {
  const [activeTab, setActiveTab] = useState<"camera" | "file">("camera");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<any | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const isStartingRef = useRef(false);
  const cameraContainerId = "barcode-scanner-container";

  // Helper function to stop camera safely
  const stopCameraSafely = useCallback(async () => {
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

  // Extract post-barcode logic into a single helper function
  // This ensures both camera and file upload follow the exact same flow
  const handleBarcodeDetected = useCallback(async (barcode: string) => {
    const barcodeData = barcode?.trim();
    if (!barcodeData) {
      setErrorMessage("No barcode detected. Please try again.");
      return;
    }

    // Call the parent's onDetected callback
    // This will trigger the OpenFoodFacts lookup and navigation flow
    onDetected(barcodeData);
  }, [onDetected]);


  // Helper function to start camera safely
  const startCameraSafely = useCallback(async () => {
    if (isCameraActive || !scannerRef.current || isStartingRef.current) {
      console.log("[BarcodeScanner] Skipping start - already active or starting");
      return;
    }

    try {
      setErrorMessage(null);
      setLoading(true);
      
      // Ensure container exists
      const container = document.getElementById(cameraContainerId);
      if (!container) {
        throw new Error("Scanner container not found. Please refresh the page.");
      }

      console.log("[BarcodeScanner] Starting camera...");
      
      // Create stable callback functions
      const scanSuccessCallback = async (decodedText: string, decodedResult: any) => {
        // This is the success callback - called when a barcode is detected
        console.log("[BarcodeScanner] Barcode detected:", decodedText, decodedResult);
        
        if (!decodedText) return;
        
        // Stop scanning once we have a good barcode
        await stopCameraSafely();
        
        // Handle the detected barcode
        handleBarcodeDetected(decodedText);
      };

      const scanErrorCallback = (errorMessage: string) => {
        // This is called continuously when no barcode is detected
        // We ignore these errors silently - don't log or setState here
      };

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }, // Square box for better barcode detection
          aspectRatio: 1.0, // Square aspect ratio
        },
        scanSuccessCallback,
        scanErrorCallback
      );
      
      console.log("[BarcodeScanner] Camera started successfully");
      setIsCameraActive(true);
      setLoading(false);
    } catch (err: any) {
      console.error("[BarcodeScanner] Failed to start camera", err);
      setIsCameraActive(false);
      setLoading(false);
      isStartingRef.current = false;
      
      let errorMsg = "Unable to start camera. On mobile, use HTTPS (not http://IP) and allow camera access, or switch to Upload Photo.";
      if (err?.name === "NotAllowedError") {
        errorMsg = "Camera permission denied. Please allow camera access in your browser settings, or switch to Upload Photo.";
      } else if (err?.name === "NotFoundError") {
        errorMsg = "No camera found on this device. Please use Upload Photo instead.";
      } else if (err?.name === "NotReadableError") {
        errorMsg = "Camera is in use by another app. Please close other apps using the camera, or switch to Upload Photo.";
      } else if (!window.isSecureContext && window.location.protocol !== "https:" && !window.location.hostname.includes("localhost")) {
        errorMsg = "Camera requires HTTPS. Please use HTTPS or localhost, or switch to Upload Photo.";
      }
      
      setErrorMessage(errorMsg);
    }
  }, [isCameraActive, handleBarcodeDetected, stopCameraSafely]);

  // Initialize scanner instance and manage camera lifecycle
  useEffect(() => {
    // Only run on web platform
    if (Platform.OS !== "web") return;

    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    // Initialize scanner instance if needed
    const initScanner = async () => {
      if (!scannerRef.current) {
        try {
          const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
          const container = document.getElementById(cameraContainerId);
          
          if (!container) {
            console.error("Scanner container not found");
            return;
          }

          // Configure scanner to support product barcodes (not just QR codes)
          const formatsToSupport = Html5QrcodeSupportedFormats ? [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE, // Also support QR codes
          ].filter(Boolean) : undefined;

          const config: any = {
            verbose: false,
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true, // Use native BarcodeDetector API if available
            },
          };

          if (formatsToSupport) {
            config.formatsToSupport = formatsToSupport;
          }

          scannerRef.current = new Html5Qrcode(cameraContainerId, config);
        } catch (err) {
          console.error("Failed to initialize scanner", err);
          if (isMounted) {
            setErrorMessage("Failed to load barcode scanner. Please refresh the page.");
          }
        }
      }
    };

    initScanner();

    // Start/stop camera based on active tab
    if (activeTab === "camera") {
      // Small delay to ensure DOM is ready and scanner is initialized
      timeoutId = setTimeout(async () => {
        if (!isMounted) return;
        
        // Wait for scanner to be initialized
        if (!scannerRef.current) {
          // Retry after a bit more time
          setTimeout(async () => {
            if (!isMounted || !scannerRef.current || isCameraActive || isStartingRef.current) return;
            isStartingRef.current = true;
            await startCameraSafely();
            isStartingRef.current = false;
          }, 200);
          return;
        }

        if (!isCameraActive && !isStartingRef.current) {
          isStartingRef.current = true;
          await startCameraSafely();
          isStartingRef.current = false;
        }
      }, 200);

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        isMounted = false;
        // Stop camera when tab changes away from camera or component unmounts
        stopCameraSafely();
      };
    } else {
      // When tab changes away from camera, release camera
      stopCameraSafely();
    }
  }, [activeTab]); // Removed isCameraActive and callbacks from deps to prevent restarts

  // Handle file upload - decode barcode from image
  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setLoading(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      // Create a temporary scanner instance for file decoding
      const html5QrCode = new Html5Qrcode("html5-qrcode-web-file");

      // Decode the barcode from the image file
      const result: any = await html5QrCode.scanFile(file, true);

      // Clean up temporary scanner
      try {
        html5QrCode.clear();
      } catch (cleanupErr) {
        // Ignore cleanup errors
      }

      const decoded = result?.decodedText ?? result;

      if (decoded) {
        // Use the same helper function as camera scanning
        handleBarcodeDetected(String(decoded));
      } else {
        setErrorMessage("Unable to read barcode from this image. Try a clearer, well-lit photo.");
      }
    } catch (err: any) {
      console.error("File upload scan error (html5-qrcode):", err);
      setErrorMessage("Unable to read barcode from this image. Try a clearer, well-lit photo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: "#fff" }}>
      {/* Mode toggle */}
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
          onClick={() => setActiveTab("file")}
          style={{
            padding: "8px 16px",
            borderRadius: 4,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: activeTab === "file" ? "#007AFF" : "#ccc",
            backgroundColor: activeTab === "file" ? "#007AFF" : "#fff",
            color: activeTab === "file" ? "#fff" : "#000",
            fontWeight: activeTab === "file" ? "bold" : "normal",
            cursor: "pointer",
          }}
        >
          Upload Photo
        </button>
      </View>

      {loading && activeTab === "camera" && (
        <View style={{ alignItems: "center", justifyContent: "center", marginBottom: 12, padding: 16 }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Starting camera…</Text>
        </View>
      )}

      {errorMessage && (
        <View style={{ marginBottom: 12, padding: 12, backgroundColor: "#ffebee", borderRadius: 4 }}>
          <Text style={{ color: "#c62828" }}>{errorMessage}</Text>
        </View>
      )}

      {activeTab === "camera" && (
        <>
          {/* html5-qrcode will render the video feed into this div */}
          <div 
            id={cameraContainerId} 
            style={{ 
              width: "100%", 
              height: 400,
              backgroundColor: "#000",
              visibility: loading || errorMessage ? "hidden" : "visible",
              position: loading || errorMessage ? "absolute" : "relative",
            }} 
          />
        </>
      )}

      {activeTab === "file" && (
        <View>
          <Text style={{ marginBottom: 8, fontSize: 16 }}>Upload a photo of a barcode to scan:</Text>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileChange}
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
