-- Function to delete auth user from Supabase Auth
-- This function uses the Supabase Management API to delete the auth user
-- Requires: http extension and service role key configured
--
-- IMPORTANT: 
-- 1. The RECOMMENDED approach is to use a Supabase Edge Function (see supabase/functions/delete-auth-user/)
-- 2. This database function approach requires the http extension and proper configuration
--    of the Supabase service role key, which is more complex to set up.
-- 3. The Edge Function is already implemented and should be used instead of this function.

-- First, ensure the http extension is enabled (if not already)
CREATE EXTENSION IF NOT EXISTS http;

-- Create or replace the function to delete auth user
CREATE OR REPLACE FUNCTION public.delete_auth_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_role_key TEXT;
  v_supabase_url TEXT;
  v_response http_response;
BEGIN
  -- Security check: Users can only delete their own account
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to delete account';
  END IF;
  
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Users can only delete their own account';
  END IF;

  -- Get Supabase URL and service role key from environment variables
  -- These should be set in your Supabase project settings
  -- For Supabase, you can use current_setting() if configured, or hardcode if needed
  -- Note: In production, these should be stored securely (e.g., in Supabase secrets)
  
  -- Try to get from settings (you'll need to configure these)
  BEGIN
    v_supabase_url := current_setting('app.supabase_url', true);
    v_service_role_key := current_setting('app.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    -- If not configured, you'll need to set these manually
    -- For now, we'll raise an error
    RAISE EXCEPTION 'Supabase URL and service role key must be configured. Please set app.supabase_url and app.service_role_key settings, or use a Supabase Edge Function instead.';
  END;

  -- Call Supabase Management API to delete the auth user
  SELECT * INTO v_response
  FROM http((
    'DELETE',
    v_supabase_url || '/auth/v1/admin/users/' || p_user_id::text,
    ARRAY[
      http_header('apikey', v_service_role_key),
      http_header('Authorization', 'Bearer ' || v_service_role_key),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    ''
  )::http_request);

  -- Check if the request was successful (status 200 or 204)
  IF v_response.status NOT IN (200, 204) THEN
    RAISE EXCEPTION 'Failed to delete auth user. Status: %, Response: %', v_response.status, v_response.content;
  END IF;

END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_auth_user(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.delete_auth_user(UUID) IS 'Deletes the auth user from Supabase Auth using the Management API. Requires http extension and service role key configuration.';

-- Alternative: If you prefer to use a Supabase Edge Function instead (recommended for production),
-- you can create an Edge Function that uses the Admin API and call it from the client.
-- Example Edge Function code would be:
/*
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { userId } = await req.json()
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
*/

