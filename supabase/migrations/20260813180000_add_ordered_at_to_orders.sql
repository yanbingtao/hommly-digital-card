-- Canonical business order date for eCard lifecycle (availability + hard cleanup).
-- Backfill from orders.created_at (Hommly order-row creation time). There is no
-- separate Shopify/Shopee timestamp stored today; automation may later supply ordered_at.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS ordered_at timestamptz;

UPDATE orders
SET ordered_at = created_at
WHERE ordered_at IS NULL;

ALTER TABLE orders
  ALTER COLUMN ordered_at SET DEFAULT now();

ALTER TABLE orders
  ALTER COLUMN ordered_at SET NOT NULL;

COMMENT ON COLUMN orders.ordered_at IS
  'Business order date for eCard lifecycle. Default expiry = ordered_at + 6 months; hard cleanup = effective expiry + 1 month.';

CREATE INDEX IF NOT EXISTS idx_orders_ordered_at ON orders (ordered_at);
