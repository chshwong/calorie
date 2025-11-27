-- ============================================================================
-- Add Language Preference to Profiles Table
-- ============================================================================
-- This migration adds a language_preference column to the profiles table
-- to persist the user's preferred language across devices and sessions.
-- ============================================================================

-- Add language_preference column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS language_preference VARCHAR(5) DEFAULT 'en';

-- Add a check constraint to ensure only valid language codes are stored
ALTER TABLE profiles
ADD CONSTRAINT valid_language_preference 
CHECK (language_preference IN ('en', 'fr'));

-- Create an index for potential language-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_language_preference 
ON profiles(language_preference);

-- Comment for documentation
COMMENT ON COLUMN profiles.language_preference IS 'User preferred language code (e.g., en, fr). Defaults to en.';

-- ============================================================================
-- Verification Query (run after migration to verify)
-- ============================================================================
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'language_preference';

