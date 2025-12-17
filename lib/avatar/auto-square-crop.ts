import { Platform, Image as RNImage } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

async function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  if (Platform.OS === 'web') {
    return await new Promise((resolve, reject) => {
      const img = new (window as any).Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = uri;
    });
  }

  return await new Promise((resolve, reject) => {
    RNImage.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

// Center-crop to square by removing minimum excess (no resize here)
export async function autoSquareCrop(uri: string) {
  const { width: w, height: h } = await getImageSize(uri);

  const side = Math.min(w, h);
  const originX = Math.floor((w - side) / 2);
  const originY = Math.floor((h - side) / 2);

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX, originY, width: side, height: side } }],
    { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
  );

  return result.uri; // this is now a true square image with no black padding
}

