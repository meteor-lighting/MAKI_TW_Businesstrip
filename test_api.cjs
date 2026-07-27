const fs = require('node:fs');
const path = require('node:path');

const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) throw new Error('Create .env.local before running this smoke test.');

const env = {};
for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const index = line.indexOf('=');
  if (index < 1) continue;
  env[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
}

const baseUrl = String(env.VITE_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!baseUrl) throw new Error('VITE_SUPABASE_URL is not defined in .env.local.');
if (!publishableKey) throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is not defined in .env.local.');

async function test() {
  const response = await fetch(`${baseUrl}/rest/v1/countries?select=name&limit=1`, {
    headers: { apikey: publishableKey },
  });
  if (!response.ok) {
    throw new Error(`Supabase REST smoke test failed (${response.status}): ${await response.text()}`);
  }
  const rows = await response.json();
  console.log(`Supabase REST is reachable. Countries returned: ${rows.length}`);
}

test().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
