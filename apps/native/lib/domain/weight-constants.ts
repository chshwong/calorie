export const DB_MIN_WEIGHT_LB = 45;
export const DB_MAX_WEIGHT_LB = 880;
export const LB_PER_KG = 2.2046226218;

export const APP_MIN_CURRENT_WEIGHT_LB = DB_MIN_WEIGHT_LB + 5;
export const APP_MAX_CURRENT_WEIGHT_LB = DB_MAX_WEIGHT_LB - 5;

export const WEIGHT_LOSS_SUGGESTION_PCT = 0.05;
export const WEIGHT_GAIN_SUGGESTION_PCT = 0.04;
export const WEIGHT_LOSS_SUGGESTION_MAX_LB = 10;
export const WEIGHT_GAIN_SUGGESTION_MAX_LB = 10;

export const MIN_DELTA_LOSE_LB = 1;
export const MIN_DELTA_GAIN_LB = 1;
export const MAX_DELTA_LOSE_PCT = 0.5;
export const MAX_DELTA_GAIN_PCT = 0.35;

export const MAINTAIN_RECOMP_PCT = 0.02;
export const MAINTAIN_RECOMP_ABS_CAP_LB = 5;

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}
