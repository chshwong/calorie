-- Migration: Add focus_module preferences to profiles table
-- Adds three new columns: focus_module_1, focus_module_2, focus_module_3
-- Allowed values: 'Food', 'Exercise', 'Med', 'Water'
-- Defaults: focus_module_1 = 'Food', focus_module_2 = 'Exercise', focus_module_3 = 'Med'

-- Add columns with defaults
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS focus_module_1 TEXT NOT NULL DEFAULT 'Food',
ADD COLUMN IF NOT EXISTS focus_module_2 TEXT NOT NULL DEFAULT 'Exercise',
ADD COLUMN IF NOT EXISTS focus_module_3 TEXT NOT NULL DEFAULT 'Med';

-- Add constraints to ensure valid values
ALTER TABLE profiles 
ADD CONSTRAINT profiles_focus_module_1_chk CHECK (focus_module_1 IN ('Food','Exercise','Med','Water'));

ALTER TABLE profiles 
ADD CONSTRAINT profiles_focus_module_2_chk CHECK (focus_module_2 IN ('Food','Exercise','Med','Water'));

ALTER TABLE profiles 
ADD CONSTRAINT profiles_focus_module_3_chk CHECK (focus_module_3 IN ('Food','Exercise','Med','Water'));

