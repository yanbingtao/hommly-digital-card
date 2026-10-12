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
