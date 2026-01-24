import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { SupportCaseCategory } from '@/utils/types';
import { createCase } from '@/lib/services/cases';
import { insertCaseAttachmentRow, uploadCaseAttachment } from '@/lib/services/caseAttachments';
import { compressSupportScreenshot } from '@/utils/compressImage';
import { myCasesQueryKeyBase } from '@/hooks/use-cases';
import type { SupportSubmitError } from '@/lib/services/supportSubmitErrors';

export function useSubmitSupportCase() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      category: SupportCaseCategory;
      subject?: string | null;
      message: string;
      pagePath?: string | null;
      userAgent?: string | null;
      appVersion?: string | null;
      screenshotFile?: File | null;
    }) => {
      if (!userId) {
        const out: SupportSubmitError = { kind: 'auth' };
        throw out;
      }

      const caseId = await createCase({
        category: params.category,
        subject: params.subject ?? null,
        message: params.message,
        pagePath: params.pagePath ?? null,
        userAgent: params.userAgent ?? null,
        appVersion: params.appVersion ?? null,
      });

      if (params.screenshotFile) {
        const compressed = await compressSupportScreenshot(params.screenshotFile);
        if (!compressed.ok) {
          throw new Error(compressed.errorKey);
        }

        const upload = await uploadCaseAttachment({
          userId,
          caseId,
          file: compressed.file,
          contentType: compressed.contentType,
        });

        await insertCaseAttachmentRow({
          caseId,
          createdBy: userId,
          storagePath: upload.storagePath,
          bytes: compressed.bytes,
          contentType: compressed.contentType,
          width: compressed.width,
          height: compressed.height,
        });
      }

      return { caseId };
    },
    onSuccess: async () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: myCasesQueryKeyBase(userId) });
    },
  });
}

