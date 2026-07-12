/**
 * Supabase ADMIN client — uses the SECRET key and BYPASSES Row Level Security.
 *
 * ⚠️  This client can read and write EVERYTHING. Rules:
 *   1. `import "server-only"` below makes the build FAIL if this file is ever
 *      imported into client (browser) code. Do not remove it.
 *   2. Only use this client AFTER the calling code has verified who the user
 *      is and that they're allowed to do the thing (see lib/auth.ts guards).
 *   3. All financial writes (investments, pools, payouts, withdrawals) go
 *      through here on purpose — users have no direct write access to those
 *      tables, so every money mutation passes through validated server code.
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        // This is a machine client — never persist or refresh a session.
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
