import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import * as XLSXModule from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const XLSX = XLSXModule.default || XLSXModule;
const root = process.cwd();
loadEnv(path.join(root, '.env.local'));

const workbookArgument = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
const workbookPath = workbookArgument || path.join(root, 'Business Travel Expense DB.xlsx');
const supabaseUrl = normalizeUrl(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
const legacyServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dataKey = process.env.SUPABASE_SECRET_KEY || legacyServiceRoleKey;
const authAdminKey = legacyServiceRoleKey || dataKey;
const dryRun = process.argv.includes('--dry-run');
const listAccounts = process.argv.includes('--list-accounts');

if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is missing');
if (!dataKey && !dryRun) {
  throw new Error('Add SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY to .env.local before running the live import');
}
if (!fs.existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`);

const workbook = XLSX.readFile(workbookPath, { cellDates: true });
const rows = (sheet) => XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { defval: '', raw: true });
const members = rows('Member').filter((row) => text(row['用戶編號']));
const headers = rows('Report Header').filter((row) => text(row['報告編號']));
const reportCounts = countBy(headers, (row) => text(row['用戶編號']));

const memberGroups = new Map();
for (const member of members) {
  const email = text(member['用戶電郵地址']).toLowerCase();
  if (!email) throw new Error(`Member ${member['用戶編號']} has no email address`);
  const group = memberGroups.get(email) || [];
  group.push(member);
  memberGroups.set(email, group);
}

const accountPlan = [...memberGroups.entries()].map(([email, group]) => {
  const sorted = [...group].sort((a, b) => {
    const reportDifference = (reportCounts[text(b['用戶編號'])] || 0) - (reportCounts[text(a['用戶編號'])] || 0);
    return reportDifference || Number(text(b['用戶編號'])) - Number(text(a['用戶編號']));
  });
  const primary = sorted[0];
  const aliases = new Set();
  for (const member of group) {
    aliases.add(text(member['用戶編號']));
    aliases.add(text(member['用戶名稱']));
  }
  return { email, primary, members: group, aliases: [...aliases].filter(Boolean) };
});

const aliasOwners = new Map();
for (const account of accountPlan) {
  for (const alias of account.aliases) {
    const normalized = alias.toLowerCase();
    const owner = aliasOwners.get(normalized);
    if (owner && owner !== account.email) {
      throw new Error(`Login alias "${alias}" belongs to both ${owner} and ${account.email}`);
    }
    aliasOwners.set(normalized, account.email);
  }
}

const categorySheets = [
  'Flight', 'Accommodation', 'Rental Car', 'Gas', 'Parking', 'Transportation',
  'Internet', 'Social', 'Gift', 'Luggage Fee', 'Handing Fee', 'Per Diem',
  'Advance Payment', 'Others', 'Lunch & Learn',
];
const expenseRows = categorySheets.flatMap((category) =>
  rows(category)
    .filter((row) => text(row['報告編號']))
    .map((row) => ({ category, row }))
);

const reportIdCounts = countBy(headers, (row) => text(row['報告編號']));
const duplicateReportIds = Object.entries(reportIdCounts).filter(([, count]) => count > 1).map(([id]) => id);
const knownReportIds = new Set(Object.keys(reportIdCounts));
const orphanExpenseReportIds = [...new Set(
  expenseRows.map(({ row }) => text(row['報告編號'])).filter((id) => !knownReportIds.has(id))
)];
const expenseKeyCounts = countBy(
  expenseRows,
  ({ category, row }) => `${text(row['報告編號'])}|${category}|${Math.trunc(number(row['次序']))}`,
);
const duplicateExpenseKeys = Object.entries(expenseKeyCounts).filter(([, count]) => count > 1).map(([key]) => key);
const sourceTotalMismatches = reconcileSourceTotals(headers, expenseRows);

if (duplicateReportIds.length) throw new Error(`Duplicate report IDs: ${duplicateReportIds.join(', ')}`);
if (orphanExpenseReportIds.length) throw new Error(`Orphan expense report IDs: ${orphanExpenseReportIds.join(', ')}`);
if (duplicateExpenseKeys.length) throw new Error(`Duplicate expense keys: ${duplicateExpenseKeys.join(', ')}`);
if (sourceTotalMismatches.length) {
  throw new Error(`Source header totals do not reconcile for: ${sourceTotalMismatches.join(', ')}`);
}

const duplicateEmails = accountPlan.filter((account) => account.members.length > 1);
console.log(JSON.stringify({
  dryRun,
  workbook: path.basename(workbookPath),
  authUsers: accountPlan.length,
  sourceMembers: members.length,
  accounts: listAccounts
    ? accountPlan.map((account) => ({ email: account.email }))
    : undefined,
  mergedDuplicateEmails: duplicateEmails.map((account) => ({
    email: account.email,
    employeeCodes: account.members.map((member) => text(member['用戶編號'])),
    primaryEmployeeCode: text(account.primary['用戶編號']),
  })),
  reports: headers.length,
  expenses: expenseRows.length,
  countries: rows('Countries').filter((row) => Object.values(row).some(Boolean)).length,
  cities: rows('Cities').filter((row) => Object.values(row).some(Boolean)).length,
  flights: rows('Flights').filter((row) => text(row.FlightNumber)).length,
  reconciliation: {
    duplicateReportIds: duplicateReportIds.length,
    orphanExpenseReportIds: orphanExpenseReportIds.length,
    duplicateExpenseKeys: duplicateExpenseKeys.length,
    totalMismatches: sourceTotalMismatches.length,
  },
}, null, 2));

if (dryRun) process.exit(0);

const supabase = createClient(supabaseUrl, dataKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const existingUsers = await listAllUsers(supabaseUrl, authAdminKey);
const userByEmail = new Map(existingUsers.map((user) => [String(user.email).toLowerCase(), user]));
const missingAuthAccounts = accountPlan.filter((account) => !userByEmail.has(account.email));
if (missingAuthAccounts.length && !legacyServiceRoleKey) {
  throw new Error(
    `Add the legacy SUPABASE_SERVICE_ROLE_KEY to .env.local before importing ` +
    `${missingAuthAccounts.length} Auth account(s). Find it under Settings > API Keys > ` +
    'Legacy anon, service_role API keys.',
  );
}
const authIdByEmployeeCode = new Map();

for (const account of accountPlan) {
  let authUser = userByEmail.get(account.email);
  if (!authUser) {
    const password = crypto.randomBytes(36).toString('base64url');
    authUser = await createAuthUser(supabaseUrl, authAdminKey, {
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: {
        employee_code: text(account.primary['用戶編號']),
        display_name: text(account.primary['用戶名稱']),
        migrated_from_google_sheets: true,
      },
    });
    userByEmail.set(account.email, authUser);
  }

  const primary = account.primary;
  const profile = {
    id: authUser.id,
    employee_code: text(primary['用戶編號']),
    display_name: text(primary['用戶名稱']),
    email: account.email,
    role: text(primary['用戶權限']) === '管理員' ? 'admin' : 'user',
    can_view_others: yes(primary['可查看他人']),
    can_copy_others: yes(primary['可複製他人']),
    must_reset_password: true,
    created_at: timestamp(primary['建立時間']) || new Date().toISOString(),
  };
  assert(await supabase.from('profiles').upsert(profile, { onConflict: 'id' }), `profile ${profile.employee_code}`);

  // Dashboard-created Auth users receive temporary trigger-generated aliases.
  // Replace them with the exact aliases from the workbook so reruns are
  // deterministic and no migration-only login names remain.
  const aliasDeletion = await supabase
    .from('profile_login_aliases')
    .delete()
    .eq('user_id', authUser.id);
  if (aliasDeletion.error) throw aliasDeletion.error;
  const aliasRows = account.aliases.map((alias) => ({ alias, user_id: authUser.id }));
  assert(await supabase.from('profile_login_aliases').upsert(aliasRows, { onConflict: 'alias' }), `aliases for ${account.email}`);
  for (const member of account.members) authIdByEmployeeCode.set(text(member['用戶編號']), authUser.id);
}

const reportRecords = headers.map((row) => {
  const ownerCode = text(row['用戶編號']);
  const ownerId = authIdByEmployeeCode.get(ownerCode);
  if (!ownerId) throw new Error(`No imported user for report owner ${ownerCode}`);
  const data = sanitizeObject(row);
  return {
    id: text(row['報告編號']),
    owner_id: ownerId,
    report_name: text(row['報告名稱']),
    status: text(row['狀態']),
    days: number(row['商旅天數']),
    start_date: date(row['商旅起始日']),
    end_date: date(row['商旅結束日']),
    destination: text(row['出差國家']),
    payment_currency: text(row['支付幣別']) || 'TWD',
    data,
    created_at: timestamp(row['建立時間']) || new Date().toISOString(),
  };
});
await upsertBatches(supabase, 'reports', reportRecords, 'id');

const expenseRecords = expenseRows.map(({ category, row }) => ({
  report_id: text(row['報告編號']),
  category,
  sequence: Math.max(1, Math.trunc(number(row['次序']))),
  data: sanitizeObject(row),
}));
await upsertBatches(supabase, 'expense_items', expenseRecords, 'report_id,category,sequence');

const countryRecords = rows('Countries')
  .map((row) => ({ name: text(row['國家名稱'] || Object.values(row)[0]) }))
  .filter((row) => row.name);
await upsertBatches(supabase, 'countries', uniqueBy(countryRecords, (row) => row.name), 'name');

const cityRecords = rows('Cities')
  .map((row) => ({ name: text(row.Aba || Object.values(row)[0]) }))
  .filter((row) => row.name);
await upsertBatches(supabase, 'cities', uniqueBy(cityRecords, (row) => row.name), 'name');

const flightRecords = rows('Flights')
  .filter((row) => text(row.FlightNumber))
  .map((row) => ({
    flight_number: text(row.FlightNumber),
    week: text(row.Week),
    departure_airport_id: text(row.DepartureAirportID),
    arrival_airport_id: text(row.ArrivalAirportID),
    departure_time: text(row.DepartureTime),
    arrival_time: text(row.ArrivalTime),
    cross_day: text(row.CrossDay),
  }));
await replaceFlights(supabase, flightRecords);

assert(await supabase.rpc('sync_report_sequence'), 'report sequence');
// The workbook already contains the legacy Google Sheets totals. Do not
// recalculate imported reports here: doing so replaces the legacy provider
// rate with the rounded rate stored on an expense row and changes the result.
// Reports created or edited in Supabase are still recalculated by the RPCs.

const checks = {};
for (const table of ['profiles', 'profile_login_aliases', 'reports', 'expense_items', 'countries', 'cities', 'flight_schedules']) {
  const { count, error } = await supabase.from(table).select('*', { head: true, count: 'exact' });
  if (error) throw error;
  checks[table] = count;
}
checks.auth_users = (await listAllUsers(supabaseUrl, authAdminKey)).length;
const { count: resetRequiredCount, error: resetRequiredError } = await supabase
  .from('profiles')
  .select('*', { head: true, count: 'exact' })
  .eq('must_reset_password', true);
if (resetRequiredError) throw resetRequiredError;
checks.password_resets_required = resetRequiredCount;

const expectedChecks = {
  auth_users: accountPlan.length,
  profiles: accountPlan.length,
  profile_login_aliases: aliasOwners.size,
  reports: reportRecords.length,
  expense_items: expenseRecords.length,
  countries: uniqueBy(countryRecords, (row) => row.name).length,
  cities: uniqueBy(cityRecords, (row) => row.name).length,
  flight_schedules: flightRecords.length,
  password_resets_required: accountPlan.length,
};
const countMismatches = Object.entries(expectedChecks)
  .filter(([table, expected]) => checks[table] !== expected)
  .map(([table, expected]) => `${table}: expected ${expected}, found ${checks[table]}`);
if (countMismatches.length) {
  throw new Error(`Import count verification failed: ${countMismatches.join('; ')}`);
}
console.log('Import completed and verified:', checks);

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function normalizeUrl(value = '') {
  return value.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

function text(value) {
  return value == null ? '' : String(value).trim();
}

function number(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function yes(value) {
  return ['Y', 'YES', 'TRUE', '1'].includes(text(value).toUpperCase());
}

function date(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : localDate(parsed);
}

function timestamp(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function sanitizeObject(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => {
    if (value instanceof Date) {
      if (value.getFullYear() <= 1900 || key.includes('時間')) return [key, localTime(value)];
      if (key === '建立時間' || key === '最後修改時間') return [key, value.toISOString()];
      return [key, localDate(value)];
    }
    if (typeof value === 'number' && !Number.isFinite(value)) return [key, 0];
    return [key, value ?? ''];
  }));
}

function localDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localTime(value) {
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function countBy(values, getKey) {
  const result = {};
  for (const value of values) {
    const key = getKey(value);
    result[key] = (result[key] || 0) + 1;
  }
  return result;
}

function uniqueBy(values, getKey) {
  return [...new Map(values.map((value) => [getKey(value), value])).values()];
}

function reconcileSourceTotals(reportHeaders, expenses) {
  const totals = new Map(reportHeaders.map((header) => [text(header['報告編號']), {
    overall: 0,
    personal: 0,
    advance: 0,
    header,
  }]));
  for (const { category, row } of expenses) {
    const target = totals.get(text(row['報告編號']));
    if (!target) continue;
    const splitAmounts = category === 'Accommodation' || category === 'Rental Car';
    const overall = splitAmounts ? number(row['TWD總體金額']) : number(row['TWD金額']);
    const personal = splitAmounts ? number(row['TWD個人金額']) : number(row['TWD金額']);
    if (category === 'Advance Payment') target.advance += overall;
    else {
      target.overall += overall;
      target.personal += personal;
    }
  }
  return [...totals.entries()]
    .filter(([, value]) =>
      Math.round(value.overall) !== Math.round(number(value.header['合計TWD總體總額']))
      || Math.round(value.personal) !== Math.round(number(value.header['合計TWD個人總額']))
      || Math.round(value.advance) !== Math.round(number(value.header['預支費用總額']))
    )
    .map(([reportId]) => reportId);
}

function assert(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function upsertBatches(client, table, records, onConflict, size = 500) {
  for (let index = 0; index < records.length; index += size) {
    const batch = records.slice(index, index + size);
    assert(await client.from(table).upsert(batch, { onConflict }), `${table} batch ${index / size + 1}`);
  }
}

async function replaceFlights(client, records) {
  const deletion = await client.from('flight_schedules').delete().gte('id', 0);
  if (deletion.error) throw deletion.error;
  for (let index = 0; index < records.length; index += 500) {
    const batch = records.slice(index, index + 500);
    assert(await client.from('flight_schedules').insert(batch), `flight_schedules batch ${index / 500 + 1}`);
  }
}

async function listAllUsers(baseUrl, secretKey) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const data = await authAdminRequest(
      baseUrl,
      secretKey,
      `/auth/v1/admin/users?page=${page}&per_page=1000`,
    );
    const batch = data.users || [];
    users.push(...batch);
    if (batch.length < 1000) return users;
  }
}

async function createAuthUser(baseUrl, secretKey, user) {
  const data = await authAdminRequest(baseUrl, secretKey, '/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(user),
  });
  return data.user || data;
}

async function authAdminRequest(baseUrl, secretKey, pathname, init = {}) {
  const authorizationHeader = secretKey.startsWith('eyJ')
    ? { Authorization: `Bearer ${secretKey}` }
    : {};
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      apikey: secretKey,
      ...authorizationHeader,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Supabase Auth admin request failed (${response.status}): ${body.message || body.msg || body.error || 'Unknown error'}`);
  }
  return body;
}
