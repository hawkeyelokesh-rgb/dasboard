-- Altira Dashboard schema. Run once in Supabase: SQL Editor > New query > paste > Run.

-- ============ Tables ============

-- One row per login. role = 'admin' (sees everything) or 'host' (sees own meetings only).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'host' check (role in ('admin', 'host')),
  created_at timestamptz not null default now()
);

-- Calendly team members (closers). Used for availability and host matching.
create table if not exists public.hosts (
  id uuid primary key default gen_random_uuid(),
  name text not null,                        -- raw name as Calendly reports it; overwritten on every sync
  display_name text,                         -- admin-set override shown everywhere instead of `name`; sync never touches this
  email text not null unique,
  calendly_user_uri text unique,
  active boolean not null default true,      -- shown in the availability view
  created_at timestamptz not null default now()
);

-- A lead = one routing-form submission, later enriched with the booking and assigned host.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  submission_uri text unique,                -- Calendly routing form submission URI
  invitee_uri text unique,                   -- Calendly invitee URI (set when booked)
  event_uri text,
  submitted_at timestamptz,
  name text,
  email text,
  whatsapp text,
  location text,
  describes_best text,
  previously_done text,
  investment text,
  goal text,
  income_target text,
  weekly_time text,
  challenges text,
  roadmap text,
  commitment text,
  answers jsonb not null default '[]'::jsonb, -- every question/answer exactly as submitted
  routed_to text,                            -- event type / URL the form routed to
  status text not null default 'submitted' check (status in ('submitted', 'booked', 'canceled')),
  event_name text,
  host_name text,
  host_email text,
  call_start timestamptz,
  call_end timestamptz,
  meeting_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_email_idx on public.leads (lower(email));
create index if not exists leads_host_email_idx on public.leads (lower(host_email));
create index if not exists leads_call_start_idx on public.leads (call_start);
create index if not exists leads_submitted_idx on public.leads (submitted_at desc);

-- Raw webhook log, handy for debugging.
create table if not exists public.webhook_events (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  event text,
  payload jsonb,
  error text
);

-- ============ Helpers ============

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads
for each row execute function public.touch_updated_at();

-- ============ Row level security ============
-- Writes happen only from the server with the service-role key (which bypasses RLS).
-- Logged-in users can only READ, and only what these policies allow.

alter table public.profiles enable row level security;
alter table public.hosts enable row level security;
alter table public.leads enable row level security;
alter table public.webhook_events enable row level security;

drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "hosts: admin read" on public.hosts;
create policy "hosts: admin read" on public.hosts
  for select to authenticated
  using (public.is_admin());

drop policy if exists "leads: admin read all" on public.leads;
create policy "leads: admin read all" on public.leads
  for select to authenticated
  using (public.is_admin());

-- A host sees a lead only when they are the assigned host (matched by login email).
drop policy if exists "leads: host reads own meetings" on public.leads;
create policy "leads: host reads own meetings" on public.leads
  for select to authenticated
  using (host_email is not null and lower(host_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "webhook_events: admin read" on public.webhook_events;
create policy "webhook_events: admin read" on public.webhook_events
  for select to authenticated
  using (public.is_admin());

-- ============ First admin ============
-- 1) Supabase dashboard > Authentication > Users > Add user (email + password).
-- 2) Then run this with that email:
--
-- insert into public.profiles (id, email, name, role)
-- select id, email, 'Admin', 'admin' from auth.users where email = 'you@example.com'
-- on conflict (id) do update set role = 'admin';
