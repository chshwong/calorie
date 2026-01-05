import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TourId } from '@/features/tour/types';

function requireUserId(userId: string | null | undefined): string {
  if (!userId) {
    throw new Error('Tour storage requires userId');
  }
  return userId;
}

function completedKey(tourId: TourId, userId: string) {
  // Canonical (required): tour:${tourId}:completed:${userId}
  return `tour:${tourId}:completed:${userId}`;
}

function completedKeyLegacy(tourId: TourId, userId: string) {
  // Legacy: tour:${tourId}:${userId}:completed
  return `tour:${tourId}:${userId}:completed`;
}

function lastStepIndexKey(tourId: TourId, userId: string) {
  // Canonical (required): tour:${tourId}:lastStepIndex:${userId}
  return `tour:${tourId}:lastStepIndex:${userId}`;
}

function lastStepIndexKeyLegacy(tourId: TourId, userId: string) {
  // Legacy: tour:${tourId}:${userId}:lastStepIndex
  return `tour:${tourId}:${userId}:lastStepIndex`;
}

function welcomeShownKey(tourId: TourId, userId: string) {
  // Canonical: keep consistent naming for future resets
  return `tour:${tourId}:welcomeShown:${userId}`;
}

function welcomeShownKeyLegacy(tourId: TourId, userId: string) {
  return `tour:${tourId}:${userId}:welcomeShown`;
}

export async function isTourCompleted(tourId: TourId, userId: string | null | undefined) {
  const uid = requireUserId(userId);
  const canonical = await AsyncStorage.getItem(completedKey(tourId, uid));
  if (canonical === '1') return true;

  // Back-compat: migrate legacy key if present.
  const legacy = await AsyncStorage.getItem(completedKeyLegacy(tourId, uid));
  if (legacy === '1') {
    await AsyncStorage.setItem(completedKey(tourId, uid), '1');
    return true;
  }

  return false;
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
    // Also clear legacy key to avoid confusion.
    await AsyncStorage.removeItem(completedKeyLegacy(tourId, uid));
  }
}

export async function getLastStepIndex(tourId: TourId, userId: string | null | undefined) {
  const uid = requireUserId(userId);
  const raw = await AsyncStorage.getItem(lastStepIndexKey(tourId, uid));
  const legacyRaw = raw == null ? await AsyncStorage.getItem(lastStepIndexKeyLegacy(tourId, uid)) : null;
  const effective = raw ?? legacyRaw;
  if (effective == null) return null;
  const n = Number(effective);
  if (!Number.isFinite(n) || n < 0) return null;

  // Migrate legacy if needed.
  if (raw == null && legacyRaw != null) {
    await AsyncStorage.setItem(lastStepIndexKey(tourId, uid), String(Math.floor(n)));
  }

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
  await AsyncStorage.removeItem(lastStepIndexKeyLegacy(tourId, uid));
}

// One-time welcome gate (per account on device)
export async function isTourWelcomeShown(tourId: TourId, userId: string | null | undefined) {
  const uid = requireUserId(userId);
  const canonical = await AsyncStorage.getItem(welcomeShownKey(tourId, uid));
  if (canonical === '1') return true;

  const legacy = await AsyncStorage.getItem(welcomeShownKeyLegacy(tourId, uid));
  if (legacy === '1') {
    await AsyncStorage.setItem(welcomeShownKey(tourId, uid), '1');
    return true;
  }

  return false;
}

export async function setTourWelcomeShown(tourId: TourId, userId: string | null | undefined) {
  const uid = requireUserId(userId);
  await AsyncStorage.setItem(welcomeShownKey(tourId, uid), '1');
}

export async function resetTour(tourId: TourId, userId: string | null | undefined) {
  const uid = requireUserId(userId);
  await AsyncStorage.multiRemove([
    completedKey(tourId, uid),
    lastStepIndexKey(tourId, uid),
    welcomeShownKey(tourId, uid),
    // Legacy removals
    completedKeyLegacy(tourId, uid),
    lastStepIndexKeyLegacy(tourId, uid),
    welcomeShownKeyLegacy(tourId, uid),
  ]);
}


