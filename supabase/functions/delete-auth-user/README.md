# Delete Auth User Edge Function

This Supabase Edge Function deletes the auth user from Supabase Auth using the Admin API.

## Deployment

To deploy this function to your Supabase project:

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. **Deploy the function**:
   ```bash
   supabase functions deploy delete-auth-user
   ```

## Environment Variables

The function uses the following environment variables (automatically available in Supabase):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for admin operations)

These are automatically set by Supabase when the function is deployed.

## Usage

The function is called automatically by the client when a user deletes their account via the "See Ya" button in the settings screen.

## Security

- The function verifies that the user is authenticated
- Only the authenticated user can delete their own account
- Uses the service role key securely on the server side

## Alternative: Database Function

If you prefer not to use an Edge Function, you can use the database function approach in `supabase-delete-auth-user.sql`. However, this requires:
- The `http` extension enabled
- Configuration of Supabase URL and service role key in database settings
- More complex setup

The Edge Function approach is recommended as it's simpler and more secure.

