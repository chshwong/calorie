-- Add exercise tracking preference columns to profiles table
-- These columns control visibility of chips on the Exercise page

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS exercise_track_cardio_duration boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exercise_track_cardio_distance boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exercise_track_cardio_effort boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exercise_track_strength_sets boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exercise_track_strength_reps boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exercise_track_strength_effort boolean NOT NULL DEFAULT false;

-- Defaults:
-- Cardio: Duration ON, Distance ON, Effort OFF
-- Strength: Sets ON, Reps OFF, Effort OFF

