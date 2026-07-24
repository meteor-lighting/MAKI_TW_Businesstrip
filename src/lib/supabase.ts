import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';

export const supabaseUrl = rawUrl
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');

if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is not defined');
if (!supabaseKey) throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is not defined');

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // This is a client-only GitHub Pages app. The implicit recovery flow
        // lets users open password-reset emails on a different browser/device.
        flowType: 'implicit',
    },
});
