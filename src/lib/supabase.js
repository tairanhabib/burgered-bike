import { createClient } from "@supabase/supabase-js";

// Your project's PUBLIC values, baked in so the app runs with zero setup.
// The publishable key is meant to ship in client code — Row Level Security
// (see supabase-setup.sql) is what guards your data.
// ⚠️ NEVER hardcode an "sb_secret_..." key here.
// (Env vars override these if you ever rotate the keys.)
const url = import.meta.env.VITE_SUPABASE_URL || "https://nykjrqgvaljdgevfqyls.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_nDMnxt9fCZZsJsx-96qpRw_wFIvi9fe";

export const configured = Boolean(url && key);
export const supabase = createClient(url, key);
