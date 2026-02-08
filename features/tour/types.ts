export type TourStep = {
  id: string;
  anchorKey: string;
  /** i18n key for the step message (see i18n/*.json) */
  messageKey: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto' | 'center';
  scrollBehavior?: 'center' | 'start';
  narrow?: boolean;
  /** Disable spotlight cutout while keeping tooltip */
  spotlight?: boolean;
  /** Override overlay dim opacity (0..1) */
  overlayOpacity?: number;
  /** Optional vertical offset for tooltip placement */
  offsetY?: number;
};

export type TourId = 'V1_HomePageTour' | 'V1_MealtypeLogTour' | 'V1_ExercisesTour';


