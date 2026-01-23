import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { ANNOUNCEMENTS, SUPPORT_CASES } from '@/constants/constraints';

export type CompressedImageResult =
  | {
      ok: true;
      file: File;
      width: number;
      height: number;
      bytes: number;
      contentType: string;
    }
  | {
      ok: false;
      reason: 'not_an_image' | 'too_large_after_compress' | 'unexpected_error';
      errorKey: string;
    };

type WebEncodeResult = { blob: Blob; width: number; height: number; bytes: number };

async function webLoadImage(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
  return { img, url };
}

function webDrawResized(img: HTMLImageElement, maxDim: number): { canvas: HTMLCanvasElement; width: number; height: number } {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const longest = Math.max(srcW, srcH);
  const scale = longest > maxDim ? maxDim / longest : 1;
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
}

async function webEncodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas encoding failed'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

async function webCompressToTarget(params: {
  file: File;
  maxDim: number;
  targetBytes: number;
  qualities: number[];
}): Promise<WebEncodeResult> {
  const { file, maxDim, targetBytes, qualities } = params;
  const { img, url } = await webLoadImage(file);
  try {
    const { canvas, width, height } = webDrawResized(img, maxDim);
    let lastBlob: Blob | null = null;
    for (const q of qualities) {
      const blob = await webEncodeJpeg(canvas, q);
      lastBlob = blob;
      if (blob.size <= targetBytes) {
        return { blob, width, height, bytes: blob.size };
      }
    }
    if (!lastBlob) {
      throw new Error('Encoding failed');
    }
    return { blob: lastBlob, width, height, bytes: lastBlob.size };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function getFileSizeNative(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    return info.exists && typeof info.size === 'number' ? info.size : null;
  } catch {
    return null;
  }
}

/**
 * Compress an image for support case attachment upload.
 * Policy:
 * - Longest side <= 1280px
 * - Target <= 350KB
 * - Hard cap 500KB (fail if exceeded)
 */
export async function compressSupportScreenshot(input: File): Promise<CompressedImageResult> {
  if (!input.type?.startsWith('image/')) {
    return { ok: false, reason: 'not_an_image', errorKey: 'support.errors.screenshot_not_image' };
  }

  const maxDim = SUPPORT_CASES.SCREENSHOT.MAX_DIMENSION_PX;
  const targetBytes = SUPPORT_CASES.SCREENSHOT.TARGET_BYTES;
  const hardCapBytes = SUPPORT_CASES.SCREENSHOT.HARD_CAP_BYTES;

  try {
    if (Platform.OS === 'web') {
      // Pass 1: 1280px
      let r = await webCompressToTarget({
        file: input,
        maxDim,
        targetBytes,
        qualities: [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6],
      });
      // Pass 2: if still too big, retry at 1024px
      if (r.bytes > targetBytes) {
        r = await webCompressToTarget({
          file: input,
          maxDim: 1024,
          targetBytes,
          qualities: [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6],
        });
      }

      if (r.bytes > hardCapBytes) {
        return {
          ok: false,
          reason: 'too_large_after_compress',
          errorKey: 'support.errors.screenshot_too_large',
        };
      }

      const outFile = new File([r.blob], 'screenshot.jpg', { type: 'image/jpeg' });
      return { ok: true, file: outFile, width: r.width, height: r.height, bytes: r.bytes, contentType: 'image/jpeg' };
    }

    // Native fallback (not MVP-critical, but keeps shared code safe)
    const result = await ImageManipulator.manipulateAsync(
      // expo-image-manipulator expects a URI; callers should pass a file URI on native.
      (input as any).uri ?? '',
      [{ resize: { width: maxDim } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    const bytes = await getFileSizeNative(result.uri);
    if (bytes !== null && bytes > hardCapBytes) {
      return {
        ok: false,
        reason: 'too_large_after_compress',
        errorKey: 'support.errors.screenshot_too_large',
      };
    }

    // Native: return a web File-like object is not meaningful; keep error to prevent misuse.
    return {
      ok: false,
      reason: 'unexpected_error',
      errorKey: 'support.errors.screenshot_processing_failed',
    };
  } catch (e) {
    return { ok: false, reason: 'unexpected_error', errorKey: 'support.errors.screenshot_processing_failed' };
  }
}

/**
 * Compress an image for announcement upload (admin editor, web).
 * Policy:
 * - Longest side <= 1280px
 * - Target <= 350KB
 * - Hard cap 500KB
 * - JPEG output with quality loop: 0.82 → 0.72 → 0.62 → 0.52
 * - If still > 500KB at min quality, retry once with max dimension 1024
 */
export async function compressImageForUpload(input: File): Promise<CompressedImageResult> {
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(input.type)) {
    return { ok: false, reason: 'not_an_image', errorKey: 'settings.admin.images_invalid_type' };
  }

  const maxDim = ANNOUNCEMENTS.IMAGES.MAX_DIMENSION_PX;
  const targetBytes = ANNOUNCEMENTS.IMAGES.TARGET_BYTES;
  const hardCapBytes = ANNOUNCEMENTS.IMAGES.HARD_CAP_BYTES;
  const qualities = [0.82, 0.72, 0.62, 0.52];

  try {
    if (Platform.OS !== 'web') {
      return { ok: false, reason: 'unexpected_error', errorKey: 'settings.admin.images_processing_failed' };
    }

    let r = await webCompressToTarget({ file: input, maxDim, targetBytes, qualities });
    if (r.bytes > hardCapBytes) {
      r = await webCompressToTarget({ file: input, maxDim: 1024, targetBytes, qualities });
    }

    if (r.bytes > hardCapBytes) {
      return { ok: false, reason: 'too_large_after_compress', errorKey: 'settings.admin.images_too_large' };
    }

    const outFile = new File([r.blob], 'announcement.jpg', { type: 'image/jpeg' });
    return { ok: true, file: outFile, width: r.width, height: r.height, bytes: r.bytes, contentType: 'image/jpeg' };
  } catch {
    return { ok: false, reason: 'unexpected_error', errorKey: 'settings.admin.images_processing_failed' };
  }
}

