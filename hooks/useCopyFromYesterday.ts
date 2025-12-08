import { useCallback, useState } from 'react';
import { showAppToast } from '@/components/ui/app-toast';

export function useCopyFromYesterday() {
  const [isCopyingFromYesterday, setIsCopyingFromYesterday] = useState(false);

  const runCopyFromYesterday = useCallback(
    async (copyFn: () => Promise<void> | void) => {
      if (isCopyingFromYesterday) {
        // Already copying, ignore extra presses
        return;
      }

      // Show toast immediately when user triggers the action
      showAppToast("Copying from yesterday, please wait");

      setIsCopyingFromYesterday(true);
      try {
        // Support both async and sync functions
        await Promise.resolve(copyFn());
      } finally {
        setIsCopyingFromYesterday(false);
      }
    },
    [isCopyingFromYesterday]
  );

  return {
    isCopyingFromYesterday,
    runCopyFromYesterday,
  };
}
