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

| Field | Required | Description |
|-------|----------|-------------|
| `platform` | Yes | Currently `shopee` |
| `order_id` | Yes | External order ID (6–32 alphanumeric characters) |
| `mode` | No | `shared` (default) or `individual` |
| `recipient_count` | Individual only | Number of unique recipient View URLs to create |

**Backward compatibility:** omitting `mode` is equivalent to `mode: "shared"`. Existing automation payloads continue to create Shared cards unchanged.

**Shared mode** — legacy or explicit:

```json
{
  "platform": "shopee",
  "order_id": "ORDER001"
}
```

```json
{
  "platform": "shopee",
  "order_id": "ORDER001",
  "mode": "shared"
}
```

Do not send `recipient_count` for Shared requests.

**Individual mode** — one parent card with N recipient View URLs:

```json
{
  "platform": "shopee",
  "order_id": "ORDER002",
  "mode": "individual",
  "recipient_count": 37
}
```

`recipient_count` is the number of unique recipient View QRs required (gift quantity). It does **not** include an Order ID label row — do not add +1.

Unknown request fields are rejected.

### Responses

**Shared** (`mode` omitted or `"shared"`):

```json
{
  "status": "created",
  "mode": "shared",
  "platform": "shopee",
  "order_id": "ORDER001",
  "card_name": "ORDER001-20260812120000",
  "created_at": "2026-08-12T04:00:00.000Z",
  "buyer_edit_url": "https://hommly.online/e/...",
  "recipient_view_url": "https://hommly.online/g/..."
}
```

**Individual**:

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

| `mode` omitted / value | Behavior |
|------------------------|----------|
| omitted or `shared` | One Shared card; single `recipient_view_url` |
| `individual` + `recipient_count=N` | One parent card + N unique recipient `view_url` values |

Until the Shopee automation repo is updated, all production calls omit `mode` and therefore remain Shared.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server |
| `npm run build` | Production build |
| `npm run start` | Run production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |

## Deployment

The project includes a `netlify.toml` for [Netlify](https://netlify.com). Set the Supabase environment variables, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in your hosting dashboard before deploying.
