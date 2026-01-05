export type TourStep = {
  id: string;
  anchorKey: string;
  /** i18n key for the step message (see i18n/*.json) */
  messageKey: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto' | 'center';
  scrollBehavior?: 'center' | 'start';
  narrow?: boolean;
};

export type TourId = 'V1_HomePageTour' | 'V1_MealtypeLogTour' | 'V1_ExercisesTour';


