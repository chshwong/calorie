import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollView } from 'react-native';
import { Dimensions } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import type { TourId, TourStep } from '@/features/tour/types';
import { clearLastStepIndex, getLastStepIndex, isTourCompleted, setLastStepIndex, setTourCompleted } from '@/features/tour/storage';

export type SpotlightRect = { x: number; y: number; width: number; height: number };

type StartOptions = { force?: boolean };

type ScrollContainer = {
  ref: React.RefObject<ScrollView | null>;
  getScrollOffset: () => number;
};

type TourContextValue = {
  activeTourId: TourId | null;
  steps: TourStep[];
  stepIndex: number;
  spotlightRect: SpotlightRect | null;

  startTour: (tourId: TourId, steps: TourStep[], options?: StartOptions) => Promise<void>;
  next: () => void;
  back: () => void;
  skip: () => void;
  finish: () => void;

  registerAnchor: (key: string, ref: React.RefObject<any>) => void;
  unregisterAnchor: (key: string) => void;
  registerScrollContainer: (container: ScrollContainer | null) => void;
  measureAnchor: (key: string) => Promise<SpotlightRect | null>;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}

function clampNonNegative(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function isValidRect(rect: SpotlightRect | null): rect is SpotlightRect {
  return !!rect && rect.width > 0 && rect.height > 0 && Number.isFinite(rect.x) && Number.isFinite(rect.y);
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

  const anchorsRef = useRef(new Map<string, React.RefObject<any>>());
  const scrollContainerRef = useRef<ScrollContainer | null>(null);

  const registerAnchor = useCallback((key: string, ref: React.RefObject<any>) => {
    anchorsRef.current.set(key, ref);
  }, []);

  const unregisterAnchor = useCallback((key: string) => {
    anchorsRef.current.delete(key);
  }, []);

  const registerScrollContainer = useCallback((container: ScrollContainer | null) => {
    scrollContainerRef.current = container;
  }, []);

  const measureAnchor = useCallback(async (key: string): Promise<SpotlightRect | null> => {
    const ref = anchorsRef.current.get(key);
    const node = ref?.current;
    if (!node || typeof node.measureInWindow !== 'function') return null;

    return await new Promise<SpotlightRect | null>((resolve) => {
      try {
        node.measureInWindow((x: number, y: number, width: number, height: number) => {
          const rect = { x, y, width, height };
          resolve(isValidRect(rect) ? rect : null);
        });
      } catch {
        resolve(null);
      }
    });
  }, []);

  const closeOverlay = useCallback(() => {
    setActiveTourId(null);
    setSteps([]);
    setStepIndex(0);
    setSpotlightRect(null);
  }, []);

  const finish = useCallback(() => {
    const tourId = activeTourId;
    if (!tourId) return;
    // Fire and forget; UX should close immediately.
    void setTourCompleted(tourId, userId, true);
    void clearLastStepIndex(tourId, userId);
    closeOverlay();
  }, [activeTourId, closeOverlay, userId]);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  const next = useCallback(() => {
    setStepIndex((i) => {
      const last = steps.length - 1;
      if (i >= last) return i;
      return i + 1;
    });
  }, [steps.length]);

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const startTour = useCallback(
    async (tourId: TourId, nextSteps: TourStep[], options?: StartOptions) => {
      if (!userId) return;
      const force = options?.force ?? false;
      if (!force) {
        const completed = await isTourCompleted(tourId, userId);
        if (completed) return;
      }

      const last = await getLastStepIndex(tourId, userId);
      const initialIndex =
        typeof last === 'number' && last >= 0 && last < nextSteps.length ? last : 0;

      setActiveTourId(tourId);
      setSteps(nextSteps);
      setStepIndex(initialIndex);
    },
    [userId]
  );

  // Keep lastStepIndex persisted while the tour is active.
  useEffect(() => {
    if (!activeTourId) return;
    if (!userId) return;
    void setLastStepIndex(activeTourId, userId, stepIndex);
  }, [activeTourId, stepIndex, userId]);

  // On step change: scroll into view (if needed) then measure and set spotlight rect.
  useEffect(() => {
    let cancelled = false;
    const tourId = activeTourId;
    if (!tourId) return;
    const step = steps[stepIndex];
    if (!step) return;

    const run = async () => {
      // 1) initial measure
      let rect = await measureAnchor(step.anchorKey);
      if (cancelled) return;

      // 2) attempt to scroll it into view if we can and it looks off-screen
      const container = scrollContainerRef.current;
      if (container?.ref?.current && rect) {
        const { height: screenH } = Dimensions.get('window');
        const margin = 80;
        const topLimit = margin;
        const bottomLimit = screenH - margin;
        const isAbove = rect.y < topLimit;
        const isBelow = rect.y + rect.height > bottomLimit;

        if (isAbove || isBelow) {
          const currentOffset = clampNonNegative(container.getScrollOffset());
          const desired =
            step.scrollBehavior === 'start'
              ? currentOffset + rect.y - margin
              : currentOffset + rect.y - (screenH / 2 - rect.height / 2);
          container.ref.current.scrollTo({ y: clampNonNegative(desired), animated: true });

          // Allow scroll to settle before re-measuring.
          await new Promise((r) => setTimeout(r, 220));
          if (cancelled) return;
          rect = await measureAnchor(step.anchorKey);
          if (cancelled) return;
        }
      }

      // 3) set spotlight or auto-advance if missing
      if (rect) {
        setSpotlightRect(rect);
      } else {
        setSpotlightRect(null);
        // Don't block the tour if an anchor is missing; skip forward safely.
        await new Promise((r) => setTimeout(r, 180));
        if (cancelled) return;
        setStepIndex((i) => {
          const last = steps.length - 1;
          if (i >= last) return i;
          return i + 1;
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeTourId, measureAnchor, stepIndex, steps]);

  // If steps change while active, keep index in range.
  useEffect(() => {
    if (!activeTourId) return;
    setStepIndex((i) => Math.min(i, Math.max(0, steps.length - 1)));
  }, [activeTourId, steps.length]);

  const value = useMemo<TourContextValue>(
    () => ({
      activeTourId,
      steps,
      stepIndex,
      spotlightRect,

      startTour,
      next,
      back,
      skip,
      finish,

      registerAnchor,
      unregisterAnchor,
      registerScrollContainer,
      measureAnchor,
    }),
    [
      activeTourId,
      back,
      finish,
      measureAnchor,
      next,
      registerAnchor,
      registerScrollContainer,
      skip,
      spotlightRect,
      startTour,
      stepIndex,
      steps,
      unregisterAnchor,
    ]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}


