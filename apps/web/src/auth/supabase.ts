import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
