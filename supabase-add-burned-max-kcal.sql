-- Enforce a hard max for daily burned values (Burned Today / TDEE).
-- App constants: constants/constraints.ts -> BURNED.TDEE_KCAL.MAX
-- NOTE: Keep this in sync with the app constraint. App may be stricter, never looser.

ALTER TABLE public.daily_sum_burned
  DROP CONSTRAINT IF EXISTS daily_sum_burned_max_kcal_check;

ALTER TABLE public.daily_sum_burned
  ADD CONSTRAINT daily_sum_burned_max_kcal_check CHECK (
    bmr_cal <= 15000 AND
    active_cal <= 15000 AND
    tdee_cal <= 15000 AND
    system_bmr_cal <= 15000 AND
    system_active_cal <= 15000 AND
    system_tdee_cal <= 15000
  );


