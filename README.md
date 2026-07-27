# Business Travel Expense Report

A React application for managing business-trip expenses, approvals, history,
exports, and employee access. The application uses Supabase Auth and Postgres;
Google Sheets and Google Apps Script are retained only as legacy migration
source files.

## Features

- Expense forms for flights, accommodation, rental cars, transportation, and
  other categories
- Historical exchange-rate lookup through a Supabase Edge Function
- Personal, shared, daily-average, advance-payment, TWD, and USD totals
- Report locking, copying, history search, and employee permissions
- Excel, Word, and PDF-oriented report exports
- Authenticated sessions with Postgres Row Level Security

## Stack

- React, TypeScript, Tailwind CSS, and Vite
- Supabase Auth, Postgres, Row Level Security, RPC functions, and Edge Functions
- GitHub Pages

## Local setup

1. Install Node.js 20 or later and project dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env.local` and set the project URL and publishable
   key:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

3. Start the application:

   ```sh
   npm run dev
   ```

4. Create a production build:

   ```sh
   npm run build
   ```

See [SUPABASE_MIGRATION.md](SUPABASE_MIGRATION.md) for database setup, Edge
Function deployment, workbook import, and GitHub configuration.

## Database source

- `supabase/migrations/` contains the versioned Postgres schema.
- `supabase/functions/exchange-rate/` contains the exchange-rate Edge Function.
- `scripts/import-supabase.mjs` imports the legacy workbook.
- `gas/` contains the previous Apps Script backend for migration reference only;
  the frontend does not call it.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`. Configure these repository
secrets before deploying:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never put a Supabase secret or service-role key in a `VITE_` variable or a
browser deployment.
