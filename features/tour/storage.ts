import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TourId } from '@/features/tour/types';

function requireUserId(userId: string | null | undefined): string {
  if (!userId) {
    throw new Error('Tour storage requires userId');
  }
  return userId;
}

function completedKey(tourId: TourId, userId: string) {
  return `tour:${tourId}:${userId}:completed`;
}

function lastStepIndexKey(tourId: TourId, userId: string) {
  return `tour:${tourId}:${userId}:lastStepIndex`;
}

export async function isTourCompleted(tourId: TourId, userId: string | null | undefined) {
  const uid = requireUserId(userId);
  const value = await AsyncStorage.getItem(completedKey(tourId, uid));
  return value === '1';
}

export async function setTourCompleted(
  tourId: TourId,
  userId: string | null | undefined,
  completed: boolean
) {
  const uid = requireUserId(userId);
  const key = completedKey(tourId, uid);
  if (completed) {
    await AsyncStorage.setItem(key, '1');
  } else {
    await AsyncStorage.removeItem(key);
  }
}

export async function getLastStepIndex(tourId: TourId, userId: string | null | undefined) {
  const uid = requireUserId(userId);
  const raw = await AsyncStorage.getItem(lastStepIndexKey(tourId, uid));
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

export async function setLastStepIndex(
  tourId: TourId,
  userId: string | null | undefined,
  stepIndex: number
) {
  const uid = requireUserId(userId);
  const safe = Math.max(0, Math.floor(stepIndex));
  await AsyncStorage.setItem(lastStepIndexKey(tourId, uid), String(safe));
}

export async function clearLastStepIndex(tourId: TourId, userId: string | null | undefined) {
  const uid = requireUserId(userId);
  await AsyncStorage.removeItem(lastStepIndexKey(tourId, uid));
}

// One-time welcome gate (per account on device)
export async function isTourWelcomeShown(tourId: TourId, userId: string | null | undefined) {
  const uid = requireUserId(userId);
  const key = `tour:${tourId}:${uid}:welcomeShown`;
  const value = await AsyncStorage.getItem(key);
  return value === '1';
}

export async function setTourWelcomeShown(tourId: TourId, userId: string | null | undefined) {
  const uid = requireUserId(userId);
  const key = `tour:${tourId}:${uid}:welcomeShown`;
  await AsyncStorage.setItem(key, '1');
}

export async function resetTour(tourId: TourId, userId: string | null | undefined) {
  const uid = requireUserId(userId);
  await AsyncStorage.multiRemove([
    completedKey(tourId, uid),
    lastStepIndexKey(tourId, uid),
    `tour:${tourId}:${uid}:welcomeShown`,
  ]);
}


