import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

loadEnv(path.join(process.cwd(), '.env.local'));

const identifier = process.argv[2]?.trim();
const role = process.argv[3]?.trim().toLowerCase();
const allowedRoles = new Set(['admin', 'user']);
const supabaseUrl = normalizeUrl(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!identifier) throw new Error('Usage: npm run supabase:set-role -- <login-or-email> <admin|user>');
if (!allowedRoles.has(role)) throw new Error('Role must be either "admin" or "user".');
if (!supabaseUrl || !serverKey) {
  throw new Error('VITE_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.');
}

const supabase = createClient(supabaseUrl, serverKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const { data: resolved, error: resolveError } = await supabase.rpc('resolve_login', { identifier });
if (resolveError) throw resolveError;
if (!resolved?.[0]?.email) throw new Error(`No unique imported account resolves from "${identifier}".`);

const { data: updated, error: updateError } = await supabase
  .from('profiles')
  .update({ role })
  .eq('email', resolved[0].email)
  .select('employee_code, role');
if (updateError) throw updateError;
if (updated?.length !== 1 || updated[0].role !== role) {
  throw new Error(`Role update for "${identifier}" did not affect exactly one profile.`);
}

const { data: verified, error: verifyError } = await supabase
  .from('profiles')
  .select('role')
  .eq('email', resolved[0].email)
  .single();
if (verifyError) throw verifyError;
if (verified.role !== role) throw new Error(`Role verification failed for "${identifier}".`);

console.log(`${identifier} role is now ${role}; the live profile was verified.`);

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function normalizeUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}
