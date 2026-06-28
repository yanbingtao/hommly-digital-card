/*
# Simplify orders table

Admin card creation only needs an order number. Remove legacy buyer contact columns.
*/

ALTER TABLE orders
  DROP COLUMN IF EXISTS buyer_name,
  DROP COLUMN IF EXISTS buyer_email,
  DROP COLUMN IF EXISTS buyer_phone;
