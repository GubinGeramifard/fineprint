import { createClient } from "@supabase/supabase-js";

// A separate client with its own storage key so a demo (anonymous) session
// never overwrites a real signed-in user's session in the same browser.
export const supabaseDemo = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  { auth: { storageKey: "sb-signd-demo", persistSession: true, autoRefreshToken: true } }
);
