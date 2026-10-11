# Altira Dashboard (Vercel + Supabase)

One dashboard. Admin sees closers' availability, all bookings, all form answers and hosts. A host sees only their own meetings.
Data comes from Calendly webhooks (form submissions, bookings, cancellations) straight into Supabase.

## Setup (in this order)

1. **Supabase**: create a project. Open *SQL Editor*, paste all of `supabase/schema.sql`, Run.
2. **First admin**: *Authentication > Users > Add user* (your email + password, tick auto-confirm). Then run the "First admin" snippet at the bottom of `schema.sql` with your email.
3. **Calendly token**: Calendly > Integrations > API & Webhooks > create a Personal Access Token. Keep it private; it goes only into Vercel.
4. **GitHub + Vercel**: push this folder to a GitHub repo and import it in Vercel. Add these Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase > Project Settings > API)
   - `SUPABASE_SERVICE_ROLE_KEY` (same page; secret, never share)
   - `CALENDLY_TOKEN` (from step 3)
   - `CALENDLY_WEBHOOK_SIGNING_KEY` (any long random text you make up)
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL, e.g. https://altira.vercel.app, no trailing slash)

   Deploy (redeploy after adding variables).
5. **Sign in**, go to **Team**: click *1. Sync hosts*, switch on the closers, click *2. Register webhooks*.
6. **Import old data**: **Import** page, upload the Zappier sheet as CSV.
7. **Host logins**: Team > *Create login* per host. The login email must equal the host's Calendly email.
8. Turn off the Zapier Zaps once new rows appear in Leads.

## Notes
- Times are shown in India time. Slot length defaults to 60 min (changeable on the Availability page).
- Availability = the closer's default Calendly schedule minus Calendly busy times. Calendly reports busy times only for future days (max 7 days ahead); past days show recorded bookings only.
- Organization-level webhooks need a Calendly plan that includes webhooks.
- `npm run dev`, `npm test`, `npm run typecheck` for local work.
