import { createClient } from '@supabase/supabase-js';

// Supabase URL & Anon Key setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qqbctoliajbqxgcrsrkd.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_u0q3_eb65qhprzcxck51HQ_gGl0cd24';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
