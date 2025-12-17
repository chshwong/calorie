import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

const MAX_BYTES = 100 * 1024;
const SIZE = 400;

async function getFileSize(uri: string): Promise<number | null> {
  if (Platform.OS === 'web') {
    // On web, fetch the blob and check its size
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return blob.size;
    } catch (error) {
      console.error('Failed to get file size on web:', error);
      return null;
    }
  } else {
    // On native, use FileSystem
    try {
      const info = await FileSystem.getInfoAsync(uri, { size: true });
      return info.exists && typeof info.size === 'number' ? info.size : null;
    } catch (error) {
      console.error('Failed to get file size on native:', error);
      return null;
    }
  }
}

export async function prepareAvatar400(uri: string) {
  const qualities = [0.9, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35];
  let last: ImageManipulator.ImageResult | null = null;

  for (const q of qualities) {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: SIZE, height: SIZE } }],
      { compress: q, format: ImageManipulator.SaveFormat.JPEG }
    );
    last = result;

    const bytes = await getFileSize(result.uri);

    if (bytes !== null && bytes <= MAX_BYTES) {
      return { uri: result.uri, bytes };
    }
  }

  const bytes = last ? await getFileSize(last.uri) : null;
  return { uri: last?.uri ?? uri, bytes: bytes ?? null };
}

function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getFileBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    // On web, fetch the blob and convert to Uint8Array
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } else {
    // On native, read as base64 and convert
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64ToUint8Array(base64);
  }
}

export async function uploadUserAvatar(params: { userId: string; sourceUri: string }) {
  const { userId, sourceUri } = params;

  const { uri: resizedUri } = await prepareAvatar400(sourceUri);

  const bytes = await getFileBytes(resizedUri);
  const storagePath = `${userId}/avatar.jpg`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(storagePath, bytes, {
      contentType: 'image/jpeg',
      upsert: true,
      cacheControl: '3600',
    });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(storagePath);
  const publicUrl = data.publicUrl;
  const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

  return { publicUrl, cacheBustedUrl, storagePath };
}

export async function setProfileAvatarUrl(params: { userId: string; avatarUrl: string }) {
  const { userId, avatarUrl } = params;

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('user_id', userId);

  if (error) throw error;
}

