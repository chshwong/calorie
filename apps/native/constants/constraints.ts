export const POLICY = {
  DOB: { MIN_AGE_YEARS: 13, MAX_AGE_YEARS: 120 },
  PREFERRED_NAME_MAX_LEN: 30,
  PREFERRED_NAME_MAX_EMOJIS: 1,
  PREFERRED_NAME_MIN_LETTERS: 2,
} as const;

import { DB_MAX_WEIGHT_LB, DB_MIN_WEIGHT_LB, lbToKg } from "@/lib/domain/weight-constants";
import { NUTRIENT_TARGETS as ROOT_NUTRIENT_TARGETS } from "../../../constants/constraints";

export const PROFILES = {
  HEIGHT_CM: { MIN: 50, MAX: 260 },
  WEIGHT_LB: { MIN: DB_MIN_WEIGHT_LB, MAX: DB_MAX_WEIGHT_LB },
  BODY_FAT_PERCENT: { MIN_EXCLUSIVE: 2, MAX: 80 },
} as const;

export const DERIVED = {
  WEIGHT_KG: {
    MIN: lbToKg(DB_MIN_WEIGHT_LB),
    MAX: lbToKg(DB_MAX_WEIGHT_LB),
  },
} as const;

export const NUTRIENT_TARGETS = ROOT_NUTRIENT_TARGETS;
