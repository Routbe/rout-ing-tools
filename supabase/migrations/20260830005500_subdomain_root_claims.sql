-- Audit log voor root-subdomein aanvragen via /api/claim-root
create table if not exists public.subdomain_root_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_subdomain text not null,
  admin_mail_status text,
  user_mail_status text,
  error_payload text,
  created_at timestamptz not null default now()
);

create index if not exists subdomain_root_claims_user_id_idx
  on public.subdomain_root_claims (user_id, created_at desc);

grant all on public.subdomain_root_claims to service_role;

alter table public.subdomain_root_claims enable row level security;
