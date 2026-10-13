# Internal SKU Image Generator

The approved local generator is preserved in its separate release snapshot. This integration uses the same unified modern ecommerce prompt direction, GPT Image 2.5 options, paired sticker variants and three subtle hommly.sg watermarks.

## Routes and isolation

Admin sign-in now defaults to `/admin`, with two choices: eCard Management (`/admin/cards`) and SKU Image Generator (`/admin/sku-images`). Existing eCard routes and APIs continue to work. No new customer navigation, Digital Card schema changes, photo-bucket changes or cleanup-cron changes.

All SKU page/API routes require existing administrator authentication. Paid mutations also check request Origin. Images live in a new private `sku-images` bucket. New `sku_image_batches` and `sku_image_jobs` tables are service-role-only; there are no public access policies. Signed upload URLs send normalized photos directly to Supabase, avoiding Vercel's request-body limit. Full API keys never enter the browser.

## Preview before release

1. Deploy branch `codex/internal-sku-images` as a Vercel Preview; keep Production on its existing commit until validation completes.
2. Apply `supabase/migrations/20261012160000_add_internal_sku_images.sql` to a preview/test Supabase project first. It only creates isolated SKU tables/bucket.
3. Configure the following in Preview: existing admin credentials and Supabase URL/public/service-role keys, plus `SKU_IMAGES_ENABLED=true` and a server-side `OPENAI_API_KEY`. Do not expose either private key with a NEXT_PUBLIC prefix.
4. Enable/verify Vercel Fluid Compute so the process function can use its 300-second maximum. Each API invocation generates one variant, not an entire batch. SDK timeout is 240 seconds, with zero automatic retries. Streamed heartbeat events keep the connection active.
5. Verify admin sign-in → portal → both tools; logged-out and cross-origin API rejection; direct signed photo uploads; one source → two outputs; private persisted history and ZIP download. Confirm existing eCard edit/view/QR functions and original tests.
6. Only then apply the isolated migration to the selected production Supabase instance, configure the new Production variables and promote the tested commit through existing Vercel Git deployment.

## Batch behavior and limitations

1–100 sources → 2–200 outputs. Photos and logo references are normalized in the browser, including HEIC/HEIF conversion. Excel headers and SKUs are validated. Case/extension filenames match only when unambiguous. Product details/branding are visual references, not pixel locks. No automatic masking or source-patch restoration.

The browser drives sequential per-variant invocations; keep the page open while a batch runs. This first integration does not add an autonomous background worker. Pausing or closing the browser leaves unstarted tasks queued; already submitted work can finish on the server. Return to saved batch history to resume. Running tasks interrupted for more than ten minutes require explicit review and retry because a previous request may already have charged. Persisted source/variant state and a partial unique index prevent concurrent duplicate processing in the same batch. A succeeded variant cannot be automatically retried. No automatic retries after quota/auth errors.

The unwatermarked with-sticker result is stored privately for the second edit; download results get watermarks once. Files and reports persist in Supabase across Vercel deployments. Incomplete uploads remain unready and cannot run; create a new batch if upload failed. Retention/deletion of SKU assets is separate from existing Digital Card cleanup and must be configured later for regular use.

Hosting and OpenAI usage are separately billed. Confirm the Vercel account plan permits the intended business use. Production publishing and new paid image tests are not performed merely by installing this integration.

## Global Brand Assets (2026-10-13)

Apply `supabase/migrations/20261013010000_add_sku_brand_assets.sql` before deploying this update. Existing batches keep their original per-batch paths; the new version columns are nullable for these historical records. No automatic migration from a customer's previous batch logo is performed.

Administrators configure assets at `/admin/sku-images/brand-assets`. Files are fully decoded/validated server-side (static PNG/JPEG/WebP, 3 MB upload, 25 million pixel maximum) and normalized to PNG in the existing private `sku-images` bucket. A server-generated UUID path is never overwritten. Metadata includes version UUID, UTC timestamp, original filename, image dimensions, byte count and SHA256. A transactional database function publishes a version and changes its current pointer together. Removal publishes a tombstone; it does not delete historical objects. Batch creation captures the selected version IDs and immutable paths once. No client-supplied logo paths are accepted.

The New Batch form only uploads product photos. A configured logo is required. Halal Yes rows require the authorized mark; affected SKUs are listed and creation is blocked until configuration or row correction. Halal No rows never send the mark to OpenAI, even when another row in the same batch uses it.

Optional staff access uses the existing cookie-session conventions with separate `SKU_STAFF_USERNAME` and `SKU_STAFF_PASSWORD` server variables. Staff sign in at `/staff/login` and use `/staff/sku-images`. These credentials grant SKU use only, never eCard access or asset mutations. Do not distribute the administrator credentials to staff. Existing administrator login and eCard routes remain unchanged. Signed preview URLs expire after ten minutes; refresh settings to renew them.

Testing includes route-level lifecycle tests with a persistent mocked storage/database adapter, exact credential/session tests, full existing regression suite, TypeScript checks and production build. An isolated PostgreSQL test runtime also verifies the actual migrations, database privileges and disk restart persistence. HTTP end-to-end verification exercises the running Next.js production build with a local Supabase protocol adapter backed by this database and disk storage: upload, preview, replacement, removal, photo upload/readiness, historical snapshots and staff/anonymous access. No paid image request is required to verify asset management. Before production rollout, apply the migration, upload the authorized assets through settings, then verify saving/reloading and batch creation against the deployed Supabase instance.

## Temporary SKU tasks (2026-10-13)

Apply `20261013030000_temporary_sku_tasks.sql` before this update. Each task expires 24 hours after creation; existing tasks get a 24-hour window from migration time. Brand Assets are permanent. No historical batch listing is returned or shown. The current task ID can remain in its authenticated page URL to resume within the deadline, including from another device. No browser localStorage is used.

The existing authenticated daily Vercel cleanup invokes independent SKU cleanup alongside unchanged eCard cleanup. It enumerates only the expired batch's exact UUID storage prefix (including original/base/result/legacy asset files), removes storage objects first, then deletes the batch and cascaded jobs. Failed deletions retain records for retry. Global `brand-assets/` is excluded. Normal physical retention is 24–48 hours depending on the daily schedule; failures/backlog can delay deletion and are reported in cron logs. Cleanup handles up to 100 expired tasks per invocation.

Generation and expiry cleanup use database RPCs that lock the same batch row. Expired/claimed-for-cleanup tasks cannot start a new paid edit; active image requests have a ten-minute safety window, longer than the 240-second API timeout. Unfinished uploads are expired too. Brand versions remain outside temporary task retention.
