# Hommly Digital Surprise Card

A web app for pairing physical Hommly gifts with a personal digital message. Hommly admin creates a card for each gift order; the buyer customises it; the recipient opens it by scanning a QR code on the gift.

## How it works

1. **Admin** creates a card at `/admin/cards` with order and buyer details.
2. The system generates two secure links:
   - **Buyer edit link** — `/e/[editToken]` for personalising the card
   - **Recipient view link** — `/g/[publicToken]` (this is what the QR code points to)
3. **Buyer** fills in recipient name, message, photo, and theme, then publishes.
4. **Recipient** scans the QR code and opens their surprise on mobile.

## Routes

| Route | Who | Purpose |
|-------|-----|---------|
| `/` | Anyone | Landing page |
| `/admin/login` | Hommly admin | Sign in to admin |
| `/admin/cards` | Hommly admin | Create cards, copy links, view QR codes (password protected) |
| `/e/[editToken]` | Buyer | Edit and publish the card |
| `/g/[publicToken]` | Recipient | View the surprise (read-only) |

## Tech stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres)
- framer-motion
- qrcode

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Supabase](https://supabase.com) project (free tier works)

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/yanbingtao/hommly-digital-card.git
cd hommly-digital-card
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the migration file:

   `supabase/migrations/20260624121403_create_orders_and_digital_cards.sql`

3. In **Project Settings → General**, copy your **Project URL**  
   (e.g. `https://xxxxxxxx.supabase.co`).
4. In **Project Settings → API Keys**, copy your **Publishable key**  
   (the old docs call this the anon public key).

### 3. Configure environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=choose-a-strong-admin-password
```

Do not commit `.env.local` — it is already listed in `.gitignore`.

`ADMIN_USERNAME` and `ADMIN_PASSWORD` protect `/admin/cards`. Visiting the admin page will prompt for both.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Admin: [http://localhost:3000/admin/cards](http://localhost:3000/admin/cards)

### 5. Quick test

1. Create a card in admin with test order details.
2. Open the **buyer edit link**, fill in the message, and click **Publish Card**.
3. Open the **recipient link** (or scan the QR code) and tap **Tap to open**.

## Internal automation API

Hommly's Shopee automation calls `POST /api/internal/cards` to create digital cards idempotently. Authenticate with:

```text
Authorization: Bearer <AUTOMATION_SECRET>
```

Set `AUTOMATION_SECRET` in the server environment alongside the Supabase service role key.

### Request

**New Digital Cards are Individual-only.** `recipient_count` is always required. Shared mode creation is disabled (`SHARED_CARD_CREATION_DISABLED`).

| Field | Required | Description |
|-------|----------|-------------|
| `platform` | Yes | Currently `shopee` |
| `order_id` | Yes | External order ID (6–32 alphanumeric characters) |
| `recipient_count` | Yes | Number of unique recipient View URLs to create |
| `mode` | No | Optional; must be `individual` if supplied. `shared` is rejected. |

**Preferred automation payload** (mode may be omitted):

```json
{
  "platform": "shopee",
  "order_id": "ORDER002",
  "recipient_count": 37
}
```

Explicit Individual mode is also accepted:

```json
{
  "platform": "shopee",
  "order_id": "ORDER002",
  "mode": "individual",
  "recipient_count": 37
}
```

`recipient_count` is the number of unique recipient View QRs required (gift quantity). It does **not** include an Order ID label row — do not add +1.

**Rejected requests:**

- `{ platform, order_id }` without `recipient_count` → `400`
- `{ ..., mode: "shared" }` → `400 SHARED_CARD_CREATION_DISABLED`
- Individual request against an existing historical Shared card → `409 CARD_MODE_MISMATCH` (existing card is preserved)

**Shared mode** is supported only for **historical** cards already in the database. New Shared cards cannot be created via API or Admin UI.

### Admin manual creation

At `/admin/cards`, create with **Order Number** + **Quantity** only (Individual is implicit). Each quantity creates Gift #01 … Gift #N with unique View URLs and one buyer Edit URL.

### Response (Individual)

```json
{
  "status": "created",
  "mode": "individual",
  "platform": "shopee",
  "order_id": "ORDER002",
  "card_name": "ORDER002-20260812120000",
  "created_at": "2026-08-12T04:00:00.000Z",
  "buyer_edit_url": "https://hommly.online/e/...",
  "recipient_count": 3,
  "recipients": [
    { "number": 1, "label": "Gift #01", "view_url": "https://hommly.online/g/..." },
    { "number": 2, "label": "Gift #02", "view_url": "https://hommly.online/g/..." }
  ]
}
```

Individual responses do **not** include `recipient_view_url` (no parent compatibility token is exposed).

Historical **Shared** response shape (`recipient_view_url`) remains in `buildSharedInternalCardResponse` for old records only — not returned by new create requests.

### HTTP status codes

| Status | Meaning |
|--------|---------|
| `201` | Card created |
| `200` | Existing card returned (idempotent reuse) |
| `400` | Invalid request |
| `401` | Unauthorized |
| `409` | Mode or recipient-count conflict for existing order |
| `500` | Creation failure |

Idempotency key: `(platform, order_id)`. Repeating the same Individual request with the same `recipient_count` returns the same card and recipient tokens.

### Card modes

| Creation path | Behavior |
|---------------|----------|
| Admin `/admin/cards` | Individual only — Order Number + Quantity |
| `POST /api/internal/cards` | Individual only — `recipient_count` required |
| Historical Shared cards | Read/edit/view via existing URLs; not deleted or converted |

### Mac automation — Admin-created cards (Phase A)

Cards created manually at `/admin/cards` are marked `creation_source=admin` and `automation_sync_status=pending`. The Hommly Mac mini **pulls** these cards (hommly.online does not push, print, or send Lark).

**Platform identity:** Admin-created cards persist `platform=admin` (without `external_order_id`) so they never collide with Shopee `(platform, order_id)` identities. The pending API exposes `platform: "admin"` and `order_id` as the admin-entered order label (timestamp suffix stripped from `card_name` when present).

| Endpoint | Method | Body | Purpose |
|----------|--------|------|---------|
| `/api/internal/cards/pending-automation` | GET | — | List Admin Individual cards with status `pending`, `failed`, or **stale `claimed`** |
| `/api/internal/cards/automation-claim` | POST | `{ "card_id": "<uuid>" }` | Claim one card for local QR/print/Lark prep (idempotent reclaim for stale claims) |
| `/api/internal/cards/automation-ready` | POST | `{ "card_id": "<uuid>" }` | Mark Mac-side preparation complete |
| `/api/internal/cards/automation-failed` | POST | `{ "card_id": "<uuid>", "error": "..." }` | Record a safe error; card returns to pull queue on retry |

All endpoints require `Authorization: Bearer <AUTOMATION_SECRET>`.

Pending list items include `card_id` plus Individual URL shapes (`recipient_count`, `recipients[]`). No `recipient_view_url` on new Admin queue cards. Stale claimed rows keep `automation_sync_status: "claimed"` and include `claim_stale: true`.

**Crash recovery:** Mac claims `pending`/`failed` → `claimed` (sets `automation_claimed_at`). If Mac crashes before it persists `remote_card_id`, the card stays `claimed` and is **not** returned while the claim is fresh. After **30 minutes** (`AUTOMATION_CLAIM_TIMEOUT_MINUTES`), the server treats the claim as stale and the pending GET returns it again. The next Mac poll can reclaim it (compare-and-set refresh of `automation_claimed_at`). Mac does **not** compute expiry and does not need `--card-id` to recover a lost claim. Fresh `claimed` and `ready` cards are not re-queued. Historical Shared cards and Shopee automation cards stay out of this queue.

**Migration required:** run `supabase/migrations/20260814180000_add_card_automation_sync.sql` before deploying Phase A. Stale-claim recovery uses the existing `automation_claimed_at` column (no additional migration).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server |
| `npm run build` | Production build |
| `npm run start` | Run production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |

## Deployment

Production is deployed on [Vercel](https://vercel.com). Set Supabase keys, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `AUTOMATION_SECRET` in the Vercel project environment variables.

Daily expired-photo cleanup is scheduled via Vercel Cron (`vercel.json` → `/api/internal/photo-cleanup` at `0 3 * * *` UTC). Set `CRON_SECRET` (Production) so Vercel can authenticate cron invocations with `Authorization: Bearer <CRON_SECRET>`.
