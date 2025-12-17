import React, { useState, useRef, useCallback } from 'react';
import { showAppToast } from '@/components/ui/app-toast';
import { autoSquareCrop } from '@/lib/avatar/auto-square-crop';

interface AvatarUploaderProps {
  value?: string | null;
  onChange?: (uri: string | null) => void;
  size?: number;
  disabled?: boolean;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropPoint {
  x: number;
  y: number;
}

export function AvatarUploader({
  value,
  onChange,
  size = 110,
  disabled = false,
}: AvatarUploaderProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null); // Store original for re-editing
  const [cropPosition, setCropPosition] = useState<CropPoint>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<CropPoint>({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const cameraButtonSize = size / 3;
  const cropSize = 400; // Size of the crop area in the modal

  const handlePickImage = () => {
    if (disabled || isProcessing) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Check file size (10 MB limit)
    if (file.size > 10 * 1024 * 1024) {
      showAppToast('This photo is too large. Please choose an image under 10 MB.');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Read file as data URL
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = e.target?.result as string;
          
          // Immediately center-crop to square (no black bars)
          const squareUri = await autoSquareCrop(result);
          
          // Use square image for crop modal (zoom only, no padding)
          setImageSrc(squareUri);
          setOriginalImageSrc(squareUri); // Store square version for re-editing
          setShowCropModal(true);
          setCropPosition({ x: 0, y: 0 });
          setZoom(1);
          setIsDragging(false);
          setIsProcessing(false);
        } catch (error) {
          console.error('Error processing image:', error);
          showAppToast('We couldn\'t process this photo. Please try a different image.');
          setIsProcessing(false);
        }
      };
      reader.onerror = () => {
        throw new Error('Failed to read file');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error reading file:', error);
      showAppToast('We couldn\'t process this photo. Please try a different image.');
      setIsProcessing(false);
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    imageRef.current = img;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageSrc) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - cropPosition.x,
      y: e.clientY - cropPosition.y,
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!imageSrc) return;
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX - cropPosition.x,
      y: touch.clientY - cropPosition.y,
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !imageSrc) return;
      e.preventDefault();
      setCropPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart, imageSrc]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging || !imageSrc) return;
      e.preventDefault();
      const touch = e.touches[0];
      setCropPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart, imageSrc]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        setIsDragging(false);
      }
    },
    [isDragging]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault();
        setIsDragging(false);
      }
    },
    [isDragging]
  );

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp, { passive: false });
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, { passive: false });
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      document.body.style.touchAction = 'none';
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.style.touchAction = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!imageSrc) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.max(1, Math.min(3, prev + delta)));
  };

  const getCroppedImage = async (quality: number): Promise<Blob> => {
    if (!imageSrc || !imageSize || !imageRef.current || !containerRef.current) {
      throw new Error('Image not loaded');
    }

    const img = imageRef.current;
    const container = containerRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    canvas.width = 512;
    canvas.height = 512;

    // Get actual rendered dimensions and positions
    const containerRect = container.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    
    // Calculate scale from actual rendered size
    const renderedWidth = imgRect.width;
    const renderedHeight = imgRect.height;
    const scaleX = renderedWidth / imageSize.width;
    const scaleY = renderedHeight / imageSize.height;
    const scale = Math.min(scaleX, scaleY); // Use the smaller scale to match display

    // Crop area is centered in container
    const containerCenterX = containerRect.width / 2;
    const containerCenterY = containerRect.height / 2;
    const cropAreaLeft = containerCenterX - cropSize / 2;
    const cropAreaTop = containerCenterY - cropSize / 2;

    // Image position relative to container (from getBoundingClientRect)
    const imageLeftInContainer = imgRect.left - containerRect.left;
    const imageTopInContainer = imgRect.top - containerRect.top;

    // Calculate offset from image to crop area
    const offsetX = cropAreaLeft - imageLeftInContainer;
    const offsetY = cropAreaTop - imageTopInContainer;

    // Convert to original image coordinates
    const sourceX = offsetX / scale;
    const sourceY = offsetY / scale;
    const sourceCropSize = cropSize / scale;

    // Clamp to image bounds
    const clampedSourceX = Math.max(0, Math.min(sourceX, imageSize.width));
    const clampedSourceY = Math.max(0, Math.min(sourceY, imageSize.height));
    const maxSourceWidth = imageSize.width - clampedSourceX;
    const maxSourceHeight = imageSize.height - clampedSourceY;
    const actualSourceWidth = Math.min(sourceCropSize, maxSourceWidth);
    const actualSourceHeight = Math.min(sourceCropSize, maxSourceHeight);

    // Draw the cropped portion, scaled to 512x512
    ctx.drawImage(
      img,
      clampedSourceX,
      clampedSourceY,
      actualSourceWidth,
      actualSourceHeight,
      0,
      0,
      512,
      512
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas to blob conversion failed'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        quality
      );
    });
  };

  const handleSaveCrop = async () => {
    if (!imageSrc || isProcessing) return;

    setIsProcessing(true);

    try {
      // First pass: quality 0.75
      let blob = await getCroppedImage(0.75);

      // Check size and compress further if needed
      if (blob.size > 1 * 1024 * 1024) {
        // Second pass: quality 0.6
        blob = await getCroppedImage(0.6);

        if (blob.size > 1 * 1024 * 1024) {
          console.warn(
            `Processed image is ${(blob.size / 1024 / 1024).toFixed(2)} MB, target was 1 MB`
          );
        }
      }

      // Convert blob to object URL
      const objectUrl = URL.createObjectURL(blob);
      onChange?.(objectUrl);

      // Close modal but keep originalImageSrc for re-editing
      setShowCropModal(false);
      setImageSrc(null);
      setImageSize(null);
      // Keep originalImageSrc so user can re-edit
    } catch (error) {
      console.error('Error processing crop:', error);
      showAppToast('We couldn\'t process this photo. Please try a different image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelCrop = () => {
    setShowCropModal(false);
    setImageSrc(null);
    setCropPosition({ x: 0, y: 0 });
    setZoom(1);
    setIsDragging(false);
    setImageSize(null);
    // Keep originalImageSrc for re-editing
  };

  const handleEditCrop = () => {
    if (disabled || isProcessing || !originalImageSrc) return;
    setImageSrc(originalImageSrc);
    setShowCropModal(true);
    setCropPosition({ x: 0, y: 0 });
    setZoom(1);
    setIsDragging(false);
  };

  // Calculate image display dimensions
  // Image is already square, so we ensure it fills the square crop area with cover fit
  const getImageStyle = (): React.CSSProperties => {
    if (!imageSize) return {};

    // Since image is square, use the same scale for both dimensions
    // Scale based on cropSize * zoom to fill the crop area
    const scale = (cropSize * zoom) / Math.min(imageSize.width, imageSize.height);
    const scaledWidth = imageSize.width * scale;
    const scaledHeight = imageSize.height * scale;

    const containerCenterX = cropSize / 2;
    const containerCenterY = cropSize / 2;

    return {
      position: 'absolute',
      width: scaledWidth,
      height: scaledHeight,
      left: containerCenterX - scaledWidth / 2 + cropPosition.x,
      top: containerCenterY - scaledHeight / 2 + cropPosition.y,
      pointerEvents: 'none',
      objectFit: 'cover', // Ensure cover fit (no stretching)
    };
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          position: 'relative',
        }}
      >
        <button
          onClick={handlePickImage}
          disabled={disabled || isProcessing}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            border: '2px solid #E5E7EB',
            overflow: 'hidden',
            padding: 0,
            margin: 0,
            cursor: disabled || isProcessing ? 'not-allowed' : 'pointer',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Profile photo"
          aria-hint="Click to select a photo from your gallery"
        >
          {value ? (
            <img
              src={value}
              alt="Profile"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '50%',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#FFFFFF',
              }}
            >
              <svg
                width={size * 0.5}
                height={size * 0.5}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9CA3AF"
                strokeWidth="2"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          )}

          {/* Processing overlay */}
          {isProcessing && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: '2px solid #14B8A6',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                }}
              />
            </div>
          )}
        </button>

        {/* Button group - Edit and Camera buttons close together */}
        <div
          style={{
            position: 'absolute',
            bottom: -cameraButtonSize * 0.15,
            right: -cameraButtonSize * 0.15,
            display: 'flex',
            gap: 6,
            alignItems: 'flex-end',
          }}
        >
          {/* Edit button (only shown when there's a photo and original source exists) */}
          {value && originalImageSrc && (
            <button
              onClick={handleEditCrop}
              disabled={disabled || isProcessing}
              style={{
                width: cameraButtonSize,
                height: cameraButtonSize,
                borderRadius: '50%',
                backgroundColor: '#6B7280',
                border: '3px solid #FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                margin: 0,
                cursor: disabled || isProcessing ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
              aria-label="Edit crop"
              aria-hint="Click to adjust the crop of your photo"
            >
              <svg
                width={cameraButtonSize * 0.5}
                height={cameraButtonSize * 0.5}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}

          {/* Camera button overlay */}
          <button
            onClick={handlePickImage}
            disabled={disabled || isProcessing}
            style={{
              width: cameraButtonSize,
              height: cameraButtonSize,
              borderRadius: '50%',
              backgroundColor: '#14B8A6',
              border: '3px solid #FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              margin: 0,
              cursor: disabled || isProcessing ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
            aria-label="Change photo"
            aria-hint="Click to select a different photo"
          >
            <svg
              width={cameraButtonSize * 0.5}
              height={cameraButtonSize * 0.5}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* Crop Modal */}
      {showCropModal && imageSrc && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 20,
          }}
          onClick={handleCancelCrop}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              width: '100%',
              maxWidth: 600,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Crop Area */}
            <div
              ref={containerRef}
              style={{
                position: 'relative',
                width: cropSize,
                height: cropSize,
                margin: '0 auto',
                backgroundColor: '#000',
                overflow: 'hidden',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                touchAction: 'none',
              }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
            >
              {imageSrc && (
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt="Crop"
                  style={{
                    ...getImageStyle(),
                    objectFit: 'cover', // Ensure square image fills crop area with cover
                  }}
                  onLoad={handleImageLoad}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                />
              )}

              {/* Crop overlay - square guide */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: cropSize,
                  height: cropSize,
                  border: '2px solid #FFFFFF',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* Controls */}
            <div
              style={{
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Zoom slider */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#374151',
                  }}
                >
                  Zoom
                </label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{
                    width: '100%',
                  }}
                />
              </div>

              {/* Instructions */}
              <div
                style={{
                  fontSize: 12,
                  color: '#6B7280',
                  textAlign: 'center',
                }}
              >
                Drag to move • Scroll to zoom
              </div>

              {/* Buttons */}
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  onClick={handleCancelCrop}
                  disabled={isProcessing}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    backgroundColor: '#FFFFFF',
                    color: '#374151',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCrop}
                  disabled={isProcessing || !imageSize}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    backgroundColor: isProcessing || !imageSize ? '#9CA3AF' : '#14B8A6',
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: 500,
                    border: 'none',
                    cursor: isProcessing || !imageSize ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {isProcessing ? (
                    <>
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          border: '2px solid #FFFFFF',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.6s linear infinite',
                        }}
                      />
                      Processing...
                    </>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
