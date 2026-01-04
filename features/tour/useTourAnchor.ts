import { useEffect, useRef } from 'react';

import { useTour } from '@/features/tour/TourProvider';

export function useTourAnchor(anchorKey: string) {
  const ref = useRef<any>(null);
  const { registerAnchor, unregisterAnchor } = useTour();

  useEffect(() => {
    registerAnchor(anchorKey, ref);
    return () => {
      unregisterAnchor(anchorKey);
    };
  }, [anchorKey, registerAnchor, unregisterAnchor]);

  return ref;
}


