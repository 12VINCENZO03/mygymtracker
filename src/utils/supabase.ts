import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kblececenzncujpkmdjy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_-ijlz_BpVBUTZt5oyTeF_A_13Vg_JHW';

let supabaseClient: SupabaseClient | null = null;

try {
  if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
} catch (error) {
  console.warn('Inizializzazione Supabase non riuscita, esecuzione in modalità locale:', error);
  supabaseClient = null;
}

export const supabase = supabaseClient;
export default supabaseClient;
