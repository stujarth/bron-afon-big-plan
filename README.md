# One Bron Afon Plan — the Big Plan

A rolling 18-month view of Bron Afon's significant work, maintained by Directors and Heads of Service and prioritised by ELT.
Replaces the spreadsheet construct agreed at OLT on 16 September 2026 with a database-backed application; the spreadsheet
(`One_Bron_Afon_Big_Plan_v1_1_DRAFT.xlsx`) remains the offline fallback and shares the same fields.

## Stack

- **Next.js 15 / TypeScript / Tailwind 4** — host-agnostic; runs on Vercel today, Azure Static Web Apps or Container Apps later.
- **Postgres on Supabase (eu-west-2, London)** — plain Postgres; migrate to Azure Database for PostgreSQL with `pg_dump`.
  Row-level security on every table; audit trail via triggers; ELT-only guard on decision fields enforced in the database.
- **Auth (pilot)** — Supabase Auth, email + password, restricted to `@bronafon.org.uk` by a database trigger. Accounts are created
  by an admin (`select public.pilot_create_user(email, temp_password, role, name)`); users must change the temporary password on
  first sign-in. Magic links or Entra ID replace this when custom SMTP / the Bron Afon tenant are available.

## Roles

| Role | Can |
|------|-----|
| `viewer` | read everything |
| `editor` (default for allowed domains) | add and edit projects, supporting teams, confirm rows |
| `elt` | everything above + record ELT decisions, priority and rationale |
| `admin` | everything above + remove projects, change roles |

Change a role: `update public.profiles set role = 'elt' where email = 'name@bronafon.org.uk';`

## Environment

Only two variables, both public by design (protected by RLS). Never add the service-role key to the app.

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Develop

```
npm install
npm test          # unit tests for quarter and capacity logic (node:test, no extra deps)
npm run typecheck
npm run dev
```

## Database

Schema is in `supabase/migrations/` (exported from the live project's migration history). Apply in filename order to a
fresh Supabase/Postgres project to rebuild. Tables: `teams`, `projects`, `project_teams`, `profiles`, `project_history`;
view `projects_with_teams`. Admin RPCs: `admin_create_user`, `admin_set_role`, `admin_reset_password` (used by the People tab).

## Environments

| | Sandbox | Live |
|---|---|---|
| URL | ba-bigplan-sandbox.vercel.app | ba-bigplan-live.vercel.app |
| Supabase project | `nmypdtrasyfhfupondwa` | `rizemhfshcqwsvsdtkkc` (eu-west-2) |
| `NEXT_PUBLIC_ENVIRONMENT` | `sandbox` (amber banner) | empty |

`NEXT_PUBLIC_*` values are baked in at build time, so set them in each Vercel project before deploying.

## Supabase dashboard settings (live)

- Authentication → Sign In / Providers: turn off "Allow new users to sign up" (accounts are created by admins).
- Authentication → Attack protection: turn on leaked password protection.
- Site URL: the production URL.

## Moving to Bron Afon's estate

1. `pg_dump` the Supabase database → Azure Database for PostgreSQL (or keep Supabase self-hosted).
2. Deploy the Next.js app to Azure (Static Web Apps or Container Apps behind Front Door).
3. Swap auth to Entra ID; the `profiles` table and roles carry over unchanged.
