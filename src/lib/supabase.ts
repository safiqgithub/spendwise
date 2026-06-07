import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !String(supabaseUrl).includes("your-project") &&
  !String(supabaseAnonKey).includes("your-anon");

export const supabase = createClient(
  supabaseConfigured ? supabaseUrl : "https://demo.supabase.co",
  supabaseConfigured ? supabaseAnonKey : "demo-anon-key"
);
