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
    return <WebScanner onDetected={onDetected} />;
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
 * Unified web scanner with camera + file upload options
 */
function WebScanner({ onDetected }: UniversalBarcodeScannerProps) {
  const [subMode, setSubMode] = useState<"camera" | "file">("camera");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const html5QrcodeRef = useRef<any | null>(null);
  const cameraContainerId = "html5-qrcode-web-camera";

  // Start/stop camera when subMode changes
  useEffect(() => {
    if (subMode !== "camera") {
      // Stop camera if it was running
      if (html5QrcodeRef.current) {
        html5QrcodeRef.current
          .stop()
          .then(() => html5QrcodeRef.current?.clear())
          .catch(() => {});
        html5QrcodeRef.current = null;
      }
      setLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    let timeoutId: any;
    let initTimeout: any;

    async function startCamera() {
      setError(null);
      setLoading(true);

      try {
        // Wait a bit for the DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 200));

        if (!isMounted) return;

        // Ensure container exists before creating scanner
        const container = document.getElementById(cameraContainerId);
        if (!container) {
          throw new Error("Scanner container not found. Please refresh the page.");
        }

        const { Html5Qrcode } = await import("html5-qrcode");

        if (!isMounted) return;

        html5QrcodeRef.current = new Html5Qrcode(cameraContainerId);

        timeoutId = setTimeout(() => {
          if (!isMounted) return;
          setLoading(false);
          setError(
            "Unable to start camera. On mobile, use HTTPS (not http://IP) and allow camera access, or switch to Upload Photo."
          );
        }, 8000);

        await html5QrcodeRef.current.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          (decodedText: string) => {
            if (!decodedText) return;

            clearTimeout(timeoutId);
            setLoading(false);
            onDetected(decodedText);
          },
          () => {
            // onScanFailure: ignore minor failures
          }
        );

        // Clear loading state on success
        if (isMounted) {
          setLoading(false);
        }
      } catch (e: any) {
        console.error("Web camera error (html5-qrcode):", e);
        if (!isMounted) return;
        setLoading(false);

        let errorMsg = "Unable to access camera. Make sure you're on HTTPS and have granted camera permission, or switch to Upload Photo.";
        if (e?.message?.includes("container not found")) {
          errorMsg = e.message;
        } else if (e?.name === "NotAllowedError") {
          errorMsg = "Camera permission denied. Please allow camera access in your browser settings, or switch to Upload Photo.";
        } else if (e?.name === "NotFoundError") {
          errorMsg = "No camera found on this device. Please use Upload Photo instead.";
        } else if (e?.name === "NotReadableError") {
          errorMsg = "Camera is in use by another app. Please close other apps using the camera, or switch to Upload Photo.";
        } else if (!window.isSecureContext && window.location.protocol !== "https:" && !window.location.hostname.includes("localhost")) {
          errorMsg = "Camera requires HTTPS. Please use HTTPS or localhost, or switch to Upload Photo.";
        }

        setError(errorMsg);
      }
    }

    // Start camera after a small delay to ensure DOM is ready
    initTimeout = setTimeout(() => {
      startCamera();
    }, 100);

    return () => {
      isMounted = false;
      if (initTimeout) clearTimeout(initTimeout);
      if (timeoutId) clearTimeout(timeoutId);
      if (html5QrcodeRef.current) {
        html5QrcodeRef.current
          .stop()
          .then(() => html5QrcodeRef.current?.clear())
          .catch(() => {});
        html5QrcodeRef.current = null;
      }
    };
  }, [subMode, onDetected]);

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      const html5QrCode = new Html5Qrcode("html5-qrcode-web-file");

      const result: any = await html5QrCode.scanFile(file, true);

      const decoded = result?.decodedText ?? result;

      if (decoded) {
        onDetected(String(decoded));
      } else {
        setError("Unable to read barcode from this image. Try a clearer, well-lit photo.");
      }
    } catch (err: any) {
      console.error("Desktop web scanFile error (html5-qrcode):", err);
      setError("Unable to read barcode from this image. Try a clearer, well-lit photo.");
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: "#fff" }}>
      {/* Mode toggle */}
      <View style={{ flexDirection: "row", marginBottom: 12, gap: 8 }}>
        <button
          type="button"
          onClick={() => setSubMode("camera")}
          style={{
            padding: "8px 16px",
            borderRadius: 4,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: subMode === "camera" ? "#007AFF" : "#ccc",
            backgroundColor: subMode === "camera" ? "#007AFF" : "#fff",
            color: subMode === "camera" ? "#fff" : "#000",
            fontWeight: subMode === "camera" ? "bold" : "normal",
            cursor: "pointer",
          }}
        >
          Use Camera
        </button>
        <button
          type="button"
          onClick={() => setSubMode("file")}
          style={{
            padding: "8px 16px",
            borderRadius: 4,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: subMode === "file" ? "#007AFF" : "#ccc",
            backgroundColor: subMode === "file" ? "#007AFF" : "#fff",
            color: subMode === "file" ? "#fff" : "#000",
            fontWeight: subMode === "file" ? "bold" : "normal",
            cursor: "pointer",
          }}
        >
          Upload Photo
        </button>
      </View>

      {loading && subMode === "camera" && (
        <View style={{ alignItems: "center", justifyContent: "center", marginBottom: 12, padding: 16 }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Starting camera…</Text>
        </View>
      )}

      {error && (
        <View style={{ marginBottom: 12, padding: 12, backgroundColor: "#ffebee", borderRadius: 4 }}>
          <Text style={{ color: "#c62828" }}>{error}</Text>
        </View>
      )}

      {subMode === "camera" && (
        <>
          {/* html5-qrcode will render the video feed into this div */}
          <div 
            id={cameraContainerId} 
            style={{ 
              width: "100%", 
              height: 400,
              backgroundColor: "#000",
              visibility: loading || error ? "hidden" : "visible",
              position: loading || error ? "absolute" : "relative",
            }} 
          />
        </>
      )}

      {subMode === "file" && (
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
