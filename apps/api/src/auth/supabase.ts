import { createClient } from "@supabase/supabase-js";

import type { AuthVerifier } from "../middleware/requireAuth";

export function createSupabaseAuthVerifier(options: {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}): AuthVerifier {
  const supabase = createClient(
    options.SUPABASE_URL,
    options.SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  return async (token) => {
    try {
      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data.user?.email) {
        return null;
      }

      return { id: data.user.id, email: data.user.email };
    } catch {
      return null;
    }
  };
}
