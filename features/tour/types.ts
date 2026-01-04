export type TourStep = {
  id: string;
  anchorKey: string;
  message: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  scrollBehavior?: 'center' | 'start';
  narrow?: boolean;
};

export type TourId = 'V1_HomePageTour';


