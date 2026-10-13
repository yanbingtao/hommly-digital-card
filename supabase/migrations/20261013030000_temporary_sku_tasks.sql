-- Additive retention migration. Existing batches get a 24-hour download window.
alter table public.sku_image_batches add column expires_at timestamptz not null default (now()+interval '24 hours');
alter table public.sku_image_batches add column cleanup_started_at timestamptz;
create index sku_image_batches_expiry on public.sku_image_batches(expires_at);
-- Both generation and cleanup lock the same batch row to prevent deletion races.
create function public.claim_sku_image_job(p_batch_id uuid,p_job_id uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare claimed uuid;
begin
 perform 1 from sku_image_batches where id=p_batch_id and expires_at>now() and cleanup_started_at is null for update;
 if not found then return null; end if;
 if exists(select 1 from sku_image_jobs where batch_id=p_batch_id and status='running') then return null; end if;
 update sku_image_jobs set status='running',started_at=now() where id=p_job_id and batch_id=p_batch_id and status='queued' returning id into claimed;
 return claimed;
end; $$;
create function public.begin_sku_image_cleanup(p_batch_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from sku_image_batches where id=p_batch_id and expires_at<=now() for update;
 if not found then return false; end if;
 -- Image requests time out after 240 seconds; allow ten minutes before abandoned-task cleanup.
 if exists(select 1 from sku_image_jobs where batch_id=p_batch_id and status='running' and started_at>now()-interval '10 minutes') then return false; end if;
 update sku_image_batches set cleanup_started_at=coalesce(cleanup_started_at,now()) where id=p_batch_id;
 return true;
end; $$;
revoke all on function public.claim_sku_image_job(uuid,uuid),public.begin_sku_image_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.claim_sku_image_job(uuid,uuid),public.begin_sku_image_cleanup(uuid) to service_role;
