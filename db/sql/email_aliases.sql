-- Multi-domain e-mail aliases: handle@rout.be and/or handle@dlp.li, each
-- forwarding to a private inbox the member confirmed.
--
-- Run this once in the Supabase SQL editor of project ejscdvocfxbphzgfbwui.

create table if not exists public.email_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  handle text not null,
  domain text not null check (domain in ('rout.be', 'dlp.li')),
  forward_to text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'failed', 'paused')),
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (handle, domain),
  unique (user_id, domain)
);

create index if not exists email_aliases_user_id_idx on public.email_aliases (user_id);

grant select, insert, update, delete on public.email_aliases to authenticated;
grant all on public.email_aliases to service_role;

alter table public.email_aliases enable row level security;

drop policy if exists "Members read their own aliases" on public.email_aliases;
create policy "Members read their own aliases" on public.email_aliases
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Members create their own aliases" on public.email_aliases;
create policy "Members create their own aliases" on public.email_aliases
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Members update their own aliases" on public.email_aliases;
create policy "Members update their own aliases" on public.email_aliases
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Members delete their own aliases" on public.email_aliases;
create policy "Members delete their own aliases" on public.email_aliases
  for delete to authenticated
  using (auth.uid() = user_id);
