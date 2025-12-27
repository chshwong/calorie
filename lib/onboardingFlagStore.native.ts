import { getRawString, setRawString } from '@/lib/persistentCache';

type StoredFlag = 'true' | 'false';

function parseStoredFlag(raw: string | null): boolean | null {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

export function onboardingCompleteKey(userId: string) {
  return `onboarding_complete:${userId}`;
}

/**
 * Native implementation: AsyncStorage (async).
 *
 * StartupGate reads this on mount into a ref so it doesn't block rendering.
 */
export const onboardingFlagStore = {
  readSyncWeb(_userId: string): boolean | null {
    return null;
  },

  async read(userId: string): Promise<boolean | null> {
    return parseStoredFlag(await getRawString(onboardingCompleteKey(userId)));
  },

  async write(userId: string, value: boolean): Promise<void> {
    const stored: StoredFlag = value ? 'true' : 'false';
    await setRawString(onboardingCompleteKey(userId), stored);
  },
};


