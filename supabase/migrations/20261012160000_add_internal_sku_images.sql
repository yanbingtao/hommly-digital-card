-- Isolated internal tool. No changes to Digital Card tables, buckets, policies or cleanup.
create table if not exists public.sku_image_batches (
  id uuid primary key default gen_random_uuid(), name text not null,
  model text not null, quality text not null, logo_path text not null,
  halal_path text, uploads_ready boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.sku_image_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.sku_image_batches(id) on delete cascade,
  source_id uuid not null, sku text not null,
  variant text not null check (variant in ('with-sticker','without-sticker')),
  status text not null default 'queued' check(status in ('queued','running','succeeded','failed','cancelled','needs_review')),
  input jsonb not null, source_path text not null, base_path text, output_path text,
  error text, request_id text, started_at timestamptz, completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(batch_id,sku,variant)
);
create index if not exists sku_image_jobs_batch_idx on public.sku_image_jobs(batch_id,created_at);
-- One paid edit at a time per batch, including across browser tabs.
create unique index if not exists sku_image_jobs_one_running on public.sku_image_jobs(batch_id) where status='running';
alter table public.sku_image_batches enable row level security;
alter table public.sku_image_jobs enable row level security;
revoke all on public.sku_image_batches, public.sku_image_jobs from anon, authenticated;
grant all on public.sku_image_batches, public.sku_image_jobs to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('sku-images','sku-images',false,20971520,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
-- No public storage policies. Admin routes issue path-scoped signed upload/read URLs.
