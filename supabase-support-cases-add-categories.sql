-- Support Cases - Add new categories (improvement, appreciation)
--
-- NOTE:
-- `supabase-support-cases.sql` uses `create table if not exists`, so changing that file
-- does NOT update constraints in an already-provisioned database.
-- This migration updates the authoritative DB CHECK constraint.

alter table public.cases
  drop constraint if exists cases_category_valid;

alter table public.cases
  add constraint cases_category_valid
  check (
    category in (
      'bug',
      'feature_request',
      'food_addition',
      'improvement',
      'appreciation',
      'other'
    )
  );

