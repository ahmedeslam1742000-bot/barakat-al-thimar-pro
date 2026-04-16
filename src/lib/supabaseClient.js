import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("⚠️ Supabase Environment Variables are missing!");
}

// Standard initialization is usually enough. 
// Forcing headers can sometimes conflict with library internal logic for .single()
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
