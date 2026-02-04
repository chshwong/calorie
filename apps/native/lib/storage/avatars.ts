import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "@/lib/supabaseClient";

type UploadAvatarParams = {
  userId: string;
  localUri: string;
};

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_LOOKUP = (() => {
  const lookup = new Uint8Array(256);
  lookup.fill(255);
  for (let i = 0; i < BASE64_CHARS.length; i++) {
    lookup[BASE64_CHARS.charCodeAt(i)] = i;
  }
  return lookup;
})();

function base64ToUint8Array(base64: string) {
  const sanitized = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  const padding = sanitized.endsWith("==") ? 2 : sanitized.endsWith("=") ? 1 : 0;
  const byteLength = (sanitized.length * 3) / 4 - padding;
  const bytes = new Uint8Array(byteLength);

  let byteIndex = 0;
  for (let i = 0; i < sanitized.length; i += 4) {
    const c1 = BASE64_LOOKUP[sanitized.charCodeAt(i)];
    const c2 = BASE64_LOOKUP[sanitized.charCodeAt(i + 1)];
    const c3 = BASE64_LOOKUP[sanitized.charCodeAt(i + 2)];
    const c4 = BASE64_LOOKUP[sanitized.charCodeAt(i + 3)];

    const triple = (c1 << 18) | (c2 << 12) | ((c3 & 63) << 6) | (c4 & 63);

    if (byteIndex < byteLength) bytes[byteIndex++] = (triple >> 16) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = (triple >> 8) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = triple & 0xff;
  }

  return bytes;
}

async function getFileBytes(uri: string): Promise<Uint8Array> {
  if (!FileSystem.readAsStringAsync) {
    throw new Error("expo-file-system not available: readAsStringAsync missing");
  }

  // Use literal 'base64' string instead of EncodingType constant to avoid undefined errors
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64" as any,
  });

  if (typeof base64 !== "string" || base64.length === 0) {
    throw new Error("Avatar file is empty.");
  }
  return base64ToUint8Array(base64);
}

export async function uploadAvatarAsync({ userId, localUri }: UploadAvatarParams) {
  const bytes = await getFileBytes(localUri);
  const path = `${userId}/avatar.jpg`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    });

  if (error) {
    throw error;
  }

  return { path };
}
