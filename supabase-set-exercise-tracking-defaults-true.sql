-- Set all 6 exercise tracking preference columns to true for existing rows
-- and update default constraints to true

-- Update existing rows to set all columns to true
UPDATE public.profiles
SET 
  exercise_track_cardio_duration = true,
  exercise_track_cardio_distance = true,
  exercise_track_cardio_effort = true,
  exercise_track_strength_sets = true,
  exercise_track_strength_reps = true,
  exercise_track_strength_effort = true
WHERE 
  exercise_track_cardio_duration IS NULL 
  OR exercise_track_cardio_distance IS NULL 
  OR exercise_track_cardio_effort IS NULL 
  OR exercise_track_strength_sets IS NULL 
  OR exercise_track_strength_reps IS NULL 
  OR exercise_track_strength_effort IS NULL;

-- Update default constraints to true for all columns
ALTER TABLE public.profiles
  ALTER COLUMN exercise_track_cardio_duration SET DEFAULT true,
  ALTER COLUMN exercise_track_cardio_distance SET DEFAULT true,
  ALTER COLUMN exercise_track_cardio_effort SET DEFAULT true,
  ALTER COLUMN exercise_track_strength_sets SET DEFAULT true,
  ALTER COLUMN exercise_track_strength_reps SET DEFAULT true,
  ALTER COLUMN exercise_track_strength_effort SET DEFAULT true;

