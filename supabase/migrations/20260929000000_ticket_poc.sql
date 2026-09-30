create table if not exists public.events (
  id uuid primary key,
  name text not null,
  description text not null,
  venue text not null,
  starts_at timestamptz not null,
  price integer not null check (price >= 0)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text not null default 'Ticket holder',
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id),
  event_name text not null,
  venue text not null,
  event_starts_at timestamptz not null,
  status text not null check (status in ('paid', 'pending', 'cancelled')),
  total_amount integer not null check (total_amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id),
  event_name text not null,
  venue text not null,
  event_starts_at timestamptz not null,
  ticket_number text not null unique,
  holder_name text not null,
  qr_payload text not null,
  status text not null check (status in ('valid', 'used', 'cancelled')),
  issued_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists tickets_user_issued_idx on public.tickets (user_id, issued_at desc);

alter table public.events enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.tickets enable row level security;

revoke all on table public.events, public.profiles, public.orders, public.tickets from anon, authenticated;
grant select on table public.events to anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select on table public.orders, public.tickets to authenticated;
grant all on table public.events, public.profiles, public.orders, public.tickets to service_role;

drop policy if exists "Anyone can read the featured event" on public.events;
create policy "Anyone can read the featured event"
  on public.events for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can create their profile" on public.profiles;
create policy "Users can create their profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can read their orders" on public.orders;
create policy "Users can read their orders"
  on public.orders for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their tickets" on public.tickets;
create policy "Users can read their tickets"
  on public.tickets for select
  to authenticated
  using ((select auth.uid()) = user_id);

insert into public.events (id, name, description, venue, starts_at, price)
values (
  '11111111-1111-4111-8111-111111111111',
  'Field Notes — ดนตรีสดและเสวนา',
  'ค่ำคืนของดนตรีอิสระ บทสนทนาดี ๆ และผู้คนที่ชอบสิ่งเดียวกัน',
  'Warehouse 30, กรุงเทพฯ',
  '2026-11-14 18:30:00+07',
  650
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  venue = excluded.venue,
  starts_at = excluded.starts_at,
  price = excluded.price;
