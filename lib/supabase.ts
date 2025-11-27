import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase configuration
// These must be set in your .env file (see .env.example)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables at initialization
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env file. ' +
    'See .env.example for reference.'
  );
}

// Single Supabase client instance for the entire application
// Per engineering guidelines: No React component should call createClient directly
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

