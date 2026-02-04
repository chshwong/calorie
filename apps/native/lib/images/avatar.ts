import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";

const MAX_BYTES = 100 * 1024;
const SIZE = 400;
const QUALITIES = [0.9, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35];

function getBase64ByteLength(base64: string) {
  const sanitized = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  const padding = sanitized.endsWith("==") ? 2 : sanitized.endsWith("=") ? 1 : 0;
  return (sanitized.length * 3) / 4 - padding;
}

async function getFileSize(uri: string): Promise<number | null> {
  try {
    // Use literal 'base64' string instead of EncodingType constant to avoid undefined errors
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64" as any,
    });
    if (!base64) return null;
    return getBase64ByteLength(base64);
  } catch {
    return null;
  }
}

export async function prepareAvatarImageAsync(inputUri: string): Promise<{
  uri: string;
  size: number;
}> {
  let last: ImageManipulator.ImageResult | null = null;
  let lastSize = 0;

  for (const quality of QUALITIES) {
    const result = await ImageManipulator.manipulateAsync(
      inputUri,
      [{ resize: { width: SIZE, height: SIZE } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    last = result;

    const bytes = await getFileSize(result.uri);
    if (bytes !== null) {
      lastSize = bytes;
      if (bytes <= MAX_BYTES) {
        return { uri: result.uri, size: bytes };
      }
    }
  }

  return { uri: last?.uri ?? inputUri, size: lastSize };
}
