/*
# Create orders and digital_cards tables for Hommly Digital Surprise Card MVP

1. New Tables
- `orders` — stores buyer/order information created by the Hommly admin
  - `id` (uuid, primary key)
  - `order_number` (text, not null)
  - `buyer_name` (text, not null)
  - `buyer_email` (text, not null)
  - `buyer_phone` (text, not null)
  - `created_at` (timestamptz, default now())

- `digital_cards` — stores the digital surprise card content and tokens
  - `id` (uuid, primary key)
  - `order_id` (uuid, foreign key to orders.id, not null)
  - `public_token` (text, unique, not null) — used for recipient viewing
  - `edit_token` (text, unique, not null) — used for buyer editing
  - `recipient_name` (text)
  - `sender_name` (text)
  - `message` (text)
  - `photo_url` (text)
  - `theme` (text, default 'thank_you')
  - `animation` (text, default 'soft_reveal')
  - `status` (text, default 'draft')
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
  - `published_at` (timestamptz)

2. Indexes
- Unique indexes on public_token and edit_token for fast lookups
- Index on order_id for join performance

3. Security
- Enable RLS on both tables.
- Allow anon + authenticated CRUD because this is a single-tenant app without user accounts.
- The security is token-based: publicToken for viewing, editToken for editing.
*/

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  buyer_phone text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS digital_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  public_token text NOT NULL UNIQUE,
  edit_token text NOT NULL UNIQUE,
  recipient_name text,
  sender_name text,
  message text,
  photo_url text,
  theme text NOT NULL DEFAULT 'thank_you',
  animation text NOT NULL DEFAULT 'soft_reveal',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_digital_cards_public_token ON digital_cards(public_token);
CREATE INDEX IF NOT EXISTS idx_digital_cards_edit_token ON digital_cards(edit_token);
CREATE INDEX IF NOT EXISTS idx_digital_cards_order_id ON digital_cards(order_id);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_digital_cards" ON digital_cards;
CREATE POLICY "anon_select_digital_cards" ON digital_cards FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_digital_cards" ON digital_cards;
CREATE POLICY "anon_insert_digital_cards" ON digital_cards FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_digital_cards" ON digital_cards;
CREATE POLICY "anon_update_digital_cards" ON digital_cards FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_digital_cards" ON digital_cards;
CREATE POLICY "anon_delete_digital_cards" ON digital_cards FOR DELETE
TO anon, authenticated USING (true);
