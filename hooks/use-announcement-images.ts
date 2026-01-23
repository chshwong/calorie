import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { ANNOUNCEMENTS } from '@/constants/constraints';
import { compressImageForUpload } from '@/utils/compressImage';
import {
  deleteAnnouncementImage,
  updateAnnouncementImages,
  uploadAnnouncementImage,
} from '@/lib/services/announcements';
import { adminAnnouncementsQueryKeyBase, announcementQueryKey } from '@/hooks/use-announcements';

export function useAddAnnouncementImages() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { announcementId: string; existingPaths: string[]; files: File[] }) => {
      const { announcementId, existingPaths, files } = params;
      if (!announcementId) throw new Error('Announcement ID is required');

      const remaining = ANNOUNCEMENTS.IMAGES.MAX_COUNT - existingPaths.length;
      if (files.length > remaining) {
        throw new Error('settings.admin.images_too_many');
      }

      // 1) Compress ALL selected images first
      const compressed = await Promise.all(
        files.map(async (f) => {
          const r = await compressImageForUpload(f);
          if (!r.ok) throw new Error(r.errorKey);
          return r;
        })
      );

      // 2) Upload ALL compressed images
      const uploadedPaths: string[] = [];
      try {
        const uploads = await Promise.all(
          compressed.map(async (c) => {
            const up = await uploadAnnouncementImage({
              announcementId,
              file: c.file,
              contentType: c.contentType,
            });
            uploadedPaths.push(up.storagePath);
            return up.storagePath;
          })
        );

        // 3) Collect storage paths
        const nextPaths = [...existingPaths, ...uploads];

        // 4) Perform ONE update to announcements.image_paths
        const updated = await updateAnnouncementImages({ announcementId, imagePaths: nextPaths });
        return { updated };
      } catch (e) {
        // Optional cleanup: delete any newly uploaded files from this failed attempt
        if (uploadedPaths.length > 0) {
          await Promise.allSettled(uploadedPaths.map((p) => deleteAnnouncementImage({ storagePath: p })));
        }
        throw e;
      }
    },
    onSuccess: async (result, variables) => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: adminAnnouncementsQueryKeyBase(userId) });
      queryClient.invalidateQueries({ queryKey: announcementQueryKey(userId, variables.announcementId) });
      queryClient.setQueryData(announcementQueryKey(userId, variables.announcementId), result.updated);
    },
  });
}

export function useRemoveAnnouncementImage() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { announcementId: string; existingPaths: string[]; storagePath: string }) => {
      const { announcementId, existingPaths, storagePath } = params;
      if (!announcementId) throw new Error('Announcement ID is required');

      // If delete fails, do not update image_paths (prevents desync)
      await deleteAnnouncementImage({ storagePath });

      const nextPaths = existingPaths.filter((p) => p !== storagePath);
      const updated = await updateAnnouncementImages({ announcementId, imagePaths: nextPaths });
      return { updated };
    },
    onSuccess: async (result, variables) => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: adminAnnouncementsQueryKeyBase(userId) });
      queryClient.invalidateQueries({ queryKey: announcementQueryKey(userId, variables.announcementId) });
      queryClient.setQueryData(announcementQueryKey(userId, variables.announcementId), result.updated);
    },
  });
}

export function useReorderAnnouncementImages() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { announcementId: string; imagePaths: string[] }) => {
      const { announcementId, imagePaths } = params;
      const updated = await updateAnnouncementImages({ announcementId, imagePaths });
      return { updated };
    },
    onSuccess: async (result, variables) => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: adminAnnouncementsQueryKeyBase(userId) });
      queryClient.invalidateQueries({ queryKey: announcementQueryKey(userId, variables.announcementId) });
      queryClient.setQueryData(announcementQueryKey(userId, variables.announcementId), result.updated);
    },
  });
}

