-- Immutable versions and current pointers, separate from eCard data.
create table public.sku_brand_asset_versions (
 id uuid primary key, kind text not null check(kind in ('logo','halal')),
 path text unique, filename text, sha256 text, bytes integer, width integer, height integer,
 removed boolean not null default false, created_at timestamptz not null default now(),
 unique(id,kind), check ((removed and path is null) or (not removed and path is not null))
);
create table public.sku_brand_asset_current (
 kind text primary key check(kind in ('logo','halal')), asset_id uuid not null,
 foreign key(asset_id,kind) references public.sku_brand_asset_versions(id,kind)
);
alter table public.sku_image_batches add column logo_asset_id uuid references public.sku_brand_asset_versions(id);
alter table public.sku_image_batches add column halal_asset_id uuid references public.sku_brand_asset_versions(id);
alter table public.sku_brand_asset_versions enable row level security;
alter table public.sku_brand_asset_current enable row level security;
revoke all on public.sku_brand_asset_versions,public.sku_brand_asset_current from anon,authenticated;
grant select,insert on public.sku_brand_asset_versions to service_role;
grant select,insert,update on public.sku_brand_asset_current to service_role;
create function public.publish_sku_brand_asset(asset_id uuid,asset_kind text,asset_path text,asset_metadata jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 insert into sku_brand_asset_versions(id,kind,path,removed,filename,sha256,bytes,width,height)
 values(asset_id,asset_kind,asset_path,asset_path is null,asset_metadata->>'filename',asset_metadata->>'sha256',
 (asset_metadata->>'bytes')::integer,(asset_metadata->>'width')::integer,(asset_metadata->>'height')::integer);
 insert into sku_brand_asset_current(kind,asset_id) values(asset_kind,asset_id)
 on conflict(kind) do update set asset_id=excluded.asset_id;
end; $$;
revoke all on function public.publish_sku_brand_asset(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.publish_sku_brand_asset(uuid,text,text,jsonb) to service_role;
-- Removal publishes a tombstone; old objects are never deleted or overwritten.
