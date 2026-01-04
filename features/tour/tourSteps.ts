import type { TourStep } from '@/features/tour/types';

export const V1_HOMEPAGE_TOUR_STEPS: TourStep[] = [
  {
    id: 'home.curvyGauge',
    anchorKey: 'home.curvyGauge',
    message: 'This is your daily calorie target. Click gear to adjust target.',
    placement: 'auto',
    scrollBehavior: 'center',
    narrow: true,
  },
  {
    id: 'home.burnedEatenNet',
    anchorKey: 'home.burnedEatenNet',
    message: 'Keep track of your calorie deficit/surplus here.',
    placement: 'auto',
    scrollBehavior: 'center',
  },
  {
    id: 'home.burnedPencil',
    anchorKey: 'home.burnedPencil',
    message: 'For best accuracy, always update this with numbers from your wearable.',
    placement: 'auto',
    scrollBehavior: 'center',
  },
  {
    id: 'home.mealLog',
    anchorKey: 'home.mealLog',
    message: 'Click on the meal you’ve eaten to log.',
    placement: 'auto',
    scrollBehavior: 'center',
  },
  {
    id: 'home.mealSnack',
    anchorKey: 'home.mealSnack',
    message: 'Any quick bites can be logged as Snack.',
    placement: 'auto',
    scrollBehavior: 'center',
  },
  {
    id: 'home.callItADay',
    anchorKey: 'home.callItADay',
    message:
      'Optional but helpful: once you’re done logging for the day, including burned calories, then Call It a Day!',
    placement: 'auto',
    scrollBehavior: 'center',
  },
  {
    id: 'home.globalFooter',
    anchorKey: 'home.globalFooter',
    message: 'Access your other modules and setting through this navigation bar.',
    placement: 'auto',
    scrollBehavior: 'center',
  },
  {
    id: 'home.quickAddPlus',
    anchorKey: 'home.quickAddPlus',
    message:
      'Use the Plus button to quickly log anything (food, weight, exercise, supplements, and more).',
    placement: 'auto',
    scrollBehavior: 'center',
  },
];


