# Altira EXIM Academy: Calendly dashboard

## What this is
One web dashboard (Next.js 14 App Router, TypeScript, Tailwind, Supabase, deployed on Vercel).
- **Admin** sees closers' availability, all bookings, all routing-form submissions and everything about hosts.
- **Host** sees only their own assigned meetings.
- Data flows from Calendly webhooks (`routing_form_submission.created`, `invitee.created`, `invitee.canceled`) into Supabase. This replaces the old Zapier + Google Sheet ("Zappier") pipeline.

The code is built and passes typecheck, build and tests. It has NOT been run against the real Supabase or Calendly accounts yet. Next job is to deploy it and fix whatever breaks on real data.

## User
Yugi. Wants short, direct replies. Give one small step at a time in simple words. Prefers complete ready-to-use code over partial patches. Client-facing copy must not sound like AI.

## Commands
- `npm run dev` / `npm run build` / `npm run typecheck` / `npm test` (vitest)
- Build needs dummy env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Always run typecheck and tests after changes.

## Layout
- `supabase/schema.sql`: tables (profiles, hosts, leads, webhook_events), RLS, `is_admin()`. Tested in embedded Postgres (PGlite).
- `src/lib/availability.ts`: pure slot maths. Free = Calendly schedule intervals minus busy times. Date rule overrides weekday rule.
- `src/lib/webhook.ts`: `handleCalendlyEvent` with a `LeadStore` interface (lead lifecycle: submitted, booked, canceled; reschedules handled).
- `src/lib/calendly.ts`: API wrapper, webhook registration, signature check.
- `src/lib/answers.ts`: maps form question text to lead columns by regex. Likely needs tuning to the real question wording.
- `src/lib/store.ts`: Supabase-backed store using the service-role client.
- `src/app/api/**`: webhook receiver, availability, admin actions (sync-hosts, webhook, create-login, host-active, import, leads-csv).
- `src/app/admin/**`, `src/app/host`, `src/app/login`, `src/middleware.ts`.
- `tests/`: lib.test.ts (webhook flow, slots, signatures), csv.test.ts.

## Rules that must hold
- The Supabase service-role key and `CALENDLY_TOKEN` are server only. Never use them in client components, never print or commit them. Do not ask the user to paste tokens into chat; they go into Vercel env vars.
- All writes go through the service-role client on the server. Browser users only read, through RLS.
- A host sees a lead only when `lower(host_email) = lower(auth.jwt()->>'email')`. Do not weaken this.
- Times are shown in India time (Asia/Kolkata). Store UTC.
- Email matching is lowercase and uses `.eq`, never `ilike` (underscore is a wildcard).
- Webhook returns 500 on failure so Calendly retries; processing must stay idempotent.
- Calendly busy-times API only works for future windows, max 7 days. Past days use recorded bookings only.

## Business context
- Calendly routing: leads are routed by form answers to hosts and events (7 hosts, round robin, "Export-Import Business Strategy Call").
- Old Google Sheet "Zappier" columns: Name, Email, WhatsApp, Location, Describes Best, Previously Done, Investment, Goal, Income Target, Weekly Time, Challenges, Roadmap, Commitment, Submitted At, Host Name, Host Email, Event Type, Call Date & Time. The CSV import page expects these headers.
- Zapier trial ends Oct 23. Turn the Zaps off once the dashboard is receiving data.

## Open items
1. Deploy: follow README.md (Supabase schema, first admin, Vercel env vars, sync hosts, register webhooks, import CSV, create host logins).
2. Send a real form submission and booking; check the Leads page and fix `answers.ts` mapping if columns come out empty.
3. Verify the reschedule and cancel flows with real Calendly events.
4. Calendly cleanup (outside this repo): host lists and priorities for the five events, `?a3=91` link everywhere, last form question wording (Zoom to Google Meet, 1 hr).
5. Share the Zappier sheet with the team as Viewers only.
