import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AvatarUploader } from '@/components/AvatarUploader';
import { showAppToast } from '@/components/ui/app-toast';
import { useAuth } from '@/contexts/AuthContext';
import { uploadUserAvatar, setProfileAvatarUrl } from '@/lib/avatar/avatar-service';
import { userConfigQueryKey } from '@/hooks/use-user-config';
import { setPersistentCache } from '@/lib/persistentCache';

type ProfileAvatarPickerProps = {
  /** Current avatar URL (remote) OR a local preview URI. */
  avatarUrl: string | null;
  /** Called whenever the avatar changes (preview and/or persisted). */
  onAvatarUpdated?: (newUrl: string | null) => void;
  /** Avatar size in px. */
  size?: number;
  /** If false, disables picking/changing the avatar. */
  editable?: boolean;
  /**
   * If true, picking a new image immediately uploads it and persists to `profiles.avatar_url`.
   * Defaults to false (useful for onboarding where we defer persistence).
   */
  persistToProfile?: boolean;
  /** Override the user id used when persisting. Defaults to current auth user id. */
  userId?: string;
  /** Optional success toast (Settings wants this). */
  successToastMessage?: string;
};

export function ProfileAvatarPicker({
  avatarUrl,
  onAvatarUpdated,
  size = 130,
  editable = true,
  persistToProfile = false,
  userId,
  successToastMessage,
}: ProfileAvatarPickerProps) {
  const { user, profile, updateProfileState } = useAuth();
  const queryClient = useQueryClient();

  const effectiveUserId = userId ?? user?.id ?? null;
  const canPersist = persistToProfile && !!effectiveUserId;

  const [value, setValue] = useState<string | null>(avatarUrl);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(avatarUrl);
  }, [avatarUrl]);

  const disabled = !editable || saving;

  const handleChange = async (uri: string | null) => {
    setValue(uri);
    onAvatarUpdated?.(uri);

    if (!uri || !canPersist || !effectiveUserId) return;

    // If the user re-selects the already-persisted remote URL, do nothing.
    // (This also avoids trying to re-upload the existing remote URL.)
    if (uri === avatarUrl) return;

    setSaving(true);
    try {
      const { cacheBustedUrl } = await uploadUserAvatar({ userId: effectiveUserId, sourceUri: uri });
      await setProfileAvatarUrl({ userId: effectiveUserId, avatarUrl: cacheBustedUrl });

      // Update UI immediately
      setValue(cacheBustedUrl);
      onAvatarUpdated?.(cacheBustedUrl);

      // Update React Query userConfig cache (used by Settings & other screens)
      queryClient.setQueryData(userConfigQueryKey(effectiveUserId), (old: any) => {
        if (!old) return old;
        const next = { ...old, avatar_url: cacheBustedUrl };
        // Keep persistent cache in sync (useUserConfig reads `userConfig:${userId}`)
        setPersistentCache(`userConfig:${effectiveUserId}`, next);
        return next;
      });

      // Update AuthContext profile (best-effort)
      if (profile) {
        updateProfileState({ ...profile, avatar_url: cacheBustedUrl });
      }

      if (successToastMessage) {
        showAppToast(successToastMessage);
      }
    } catch (e) {
      // Revert preview on failure
      setValue(avatarUrl);
      onAvatarUpdated?.(avatarUrl);
      showAppToast("Couldn't update profile photo. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <AvatarUploader value={value} onChange={handleChange} size={size} disabled={disabled} />
    </View>
  );
}


