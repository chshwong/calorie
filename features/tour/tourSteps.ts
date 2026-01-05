import type { TourStep } from '@/features/tour/types';

export const V1_HOMEPAGE_TOUR_STEPS: TourStep[] = [
  {
    id: 'home.curvyGauge',
    anchorKey: 'home.curvyGauge',
    messageKey: 'tour.home.curvyGauge',
    placement: 'auto',
    scrollBehavior: 'center',
    narrow: true,
  },
  {
    id: 'home.burnedEatenNet',
    anchorKey: 'home.burnedEatenNet',
    messageKey: 'tour.home.burnedEatenNet',
    placement: 'auto',
    scrollBehavior: 'center',
  },
  {
    id: 'home.burnedPencil',
    anchorKey: 'home.burnedPencil',
    messageKey: 'tour.home.burnedPencil',
    placement: 'auto',
    scrollBehavior: 'center',
  },
  {
    id: 'home-macros',
    anchorKey: 'home.macrosAndOtherLimits',
    messageKey: 'tour.home.macrosAndOtherLimits',
  },
  {
    id: 'home.mealLog',
    anchorKey: 'home.mealLog',
    messageKey: 'tour.home.mealLog',
    placement: 'auto',
    scrollBehavior: 'center',
  },
  {
    id: 'home.mealSnack',
    anchorKey: 'home.mealSnack',
    messageKey: 'tour.home.mealSnack',
    placement: 'auto',
    scrollBehavior: 'center',
  },
  {
    id: 'home.callItADay',
    anchorKey: 'home.callItADay',
    messageKey: 'tour.home.callItADay',
    placement: 'auto',
    scrollBehavior: 'center',
  },
  {
    id: 'home.globalFooter',
    anchorKey: 'home.globalFooter',
    messageKey: 'tour.home.globalFooter',
    placement: 'auto',
    scrollBehavior: 'center',
  },
  {
    id: 'home.quickAddPlus',
    anchorKey: 'home.quickAddPlus',
    messageKey: 'tour.home.quickAddPlus',
    placement: 'auto',
    scrollBehavior: 'center',
  },
];

export const V1_MEALTYPELOG_TOUR_STEPS: TourStep[] = [
  { id: 'mt-intro', anchorKey: 'mealtype.root', messageKey: 'tour.mealtype.intro' },

  {
    id: 'mt-search',
    anchorKey: 'mealtype.searchBar',
    messageKey: 'tour.mealtype.search',
  },

  { id: 'mt-barcode', anchorKey: 'mealtype.barcodeBtn', messageKey: 'tour.mealtype.barcode' },

  {
    id: 'mt-frequent',
    anchorKey: 'mealtype.tabsAndList',
    messageKey: 'tour.mealtype.frequent',
  },

  {
    id: 'mt-custom',
    anchorKey: 'mealtype.tabsAndList',
    messageKey: 'tour.mealtype.custom',
  },

  {
    id: 'mt-bundles',
    anchorKey: 'mealtype.tabsAndList',
    messageKey: 'tour.mealtype.bundles',
  },

  {
    id: 'mt-quicklog',
    anchorKey: 'mealtype.quickLogTab',
    messageKey: 'tour.mealtype.quicklog',
  },

  {
    id: 'mt-foodlog',
    anchorKey: 'mealtype.foodLogSection',
    messageKey: 'tour.mealtype.foodlog',
  },
];

export const V1_EXERCISES_TOUR_STEPS: TourStep[] = [
  {
    id: 'ex-intro',
    anchorKey: 'exercise.screen',
    messageKey: 'tour.exercises.intro',
    placement: 'center',
  },
  {
    id: 'ex-day-summary',
    anchorKey: 'exercise.daySummary',
    messageKey: 'tour.exercises.daySummary',
  },
  {
    id: 'ex-day-summary-gear',
    anchorKey: 'exercise.daySummaryGear',
    messageKey: 'tour.exercises.daySummaryGear',
  },
  {
    id: 'ex-quick-add',
    anchorKey: 'exercise.quickAdd',
    messageKey: 'tour.exercises.quickAdd',
  },
  {
    id: 'ex-log-exercise-btn',
    anchorKey: 'exercise.logExerciseBtn',
    messageKey: 'tour.exercises.logExerciseBtn',
  },
];


