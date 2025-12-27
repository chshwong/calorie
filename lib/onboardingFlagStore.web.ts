import { getRawStringSyncWeb, setRawString } from '@/lib/persistentCache';

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
 * Web implementation: localStorage (sync).
 */
export const onboardingFlagStore = {
  readSyncWeb(userId: string): boolean | null {
    return parseStoredFlag(getRawStringSyncWeb(onboardingCompleteKey(userId)));
  },

  async read(userId: string): Promise<boolean | null> {
    return this.readSyncWeb(userId);
  },

  async write(userId: string, value: boolean): Promise<void> {
    const stored: StoredFlag = value ? 'true' : 'false';
    await setRawString(onboardingCompleteKey(userId), stored);
  },
};


