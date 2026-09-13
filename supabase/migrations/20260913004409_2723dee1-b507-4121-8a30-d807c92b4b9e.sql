alter table public.machine_units add column if not exists customer_sn text;
alter table public.appointments add column if not exists customer_sn text;
alter table public.work_orders add column if not exists customer_sn text;

create index if not exists machine_units_customer_sn_idx on public.machine_units (customer_sn);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id text,
  action text not null,
  actor text not null default 'viewer',
  summary text,
  changes jsonb,
  created_at timestamptz not null default now()
);

grant select, insert on public.audit_log to anon;
grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;

alter table public.audit_log enable row level security;

drop policy if exists "audit_log read" on public.audit_log;
create policy "audit_log read" on public.audit_log for select to anon, authenticated using (true);

drop policy if exists "audit_log insert" on public.audit_log;
create policy "audit_log insert" on public.audit_log for insert to anon, authenticated with check (true);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);