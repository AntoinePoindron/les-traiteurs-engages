import { createClient } from "@supabase/supabase-js";

/**
 * Client service-role (bypass RLS).
 * À utiliser UNIQUEMENT dans des Server Actions/Route Handlers
 * après vérification manuelle de l'ownership.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
