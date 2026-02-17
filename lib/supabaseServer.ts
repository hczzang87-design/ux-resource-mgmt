import { createClient } from "@supabase/supabase-js";

console.log("✅ LOADED: lib/supabaseServer.ts");

export function supabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("URL:", url);
  console.log("KEY exists:", !!key);

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
