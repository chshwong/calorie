-- Legal documents storage
create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null, -- 'terms', 'privacy', 'health_disclaimer'
  version text not null,  -- e.g. '2025-01-01'
  title text not null,
  content_md text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Ensure a single active version per doc_type
create unique index if not exists legal_documents_active_doc_type_idx
  on public.legal_documents (doc_type)
  where is_active;

-- Track user acceptances
create table if not exists public.user_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null,
  version text not null,
  accepted_at timestamptz not null default now()
);

create index if not exists user_legal_acceptances_user_doc_idx
  on public.user_legal_acceptances (user_id, doc_type);





