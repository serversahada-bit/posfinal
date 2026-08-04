ALTER TABLE orders
  ADD COLUMN pending_at TIMESTAMP NULL DEFAULT NULL AFTER created_at,
  ADD COLUMN processing_at TIMESTAMP NULL DEFAULT NULL AFTER pending_at,
  ADD COLUMN last_update TIMESTAMP NULL DEFAULT NULL AFTER updated_at;

ALTER TABLE orders_cso
  ADD COLUMN pending_at TIMESTAMP NULL DEFAULT NULL AFTER created_at,
  ADD COLUMN processing_at TIMESTAMP NULL DEFAULT NULL AFTER pending_at,
  ADD COLUMN last_update TIMESTAMP NULL DEFAULT NULL AFTER updated_at;

ALTER TABLE orders_crm
  ADD COLUMN pending_at TIMESTAMP NULL DEFAULT NULL AFTER created_at,
  ADD COLUMN processing_at TIMESTAMP NULL DEFAULT NULL AFTER pending_at,
  ADD COLUMN last_update TIMESTAMP NULL DEFAULT NULL AFTER updated_at;

UPDATE orders
SET
  pending_at = CASE
    WHEN order_status = 'pending' THEN COALESCE(updated_at, created_at)
    ELSE created_at
  END,
  processing_at = CASE
    WHEN order_status IN ('processing', 'ready_to_ship', 'shipped', 'completed', 'rts', 'problem') THEN COALESCE(updated_at, created_at)
    ELSE NULL
  END,
  last_update = COALESCE(updated_at, created_at)
WHERE pending_at IS NULL OR processing_at IS NULL OR last_update IS NULL;

UPDATE orders_cso
SET
  pending_at = CASE
    WHEN order_status = 'pending' THEN COALESCE(updated_at, created_at)
    ELSE created_at
  END,
  processing_at = CASE
    WHEN order_status IN ('processing', 'ready_to_ship', 'shipped', 'completed', 'rts', 'problem') THEN COALESCE(updated_at, created_at)
    ELSE NULL
  END,
  last_update = COALESCE(updated_at, created_at)
WHERE pending_at IS NULL OR processing_at IS NULL OR last_update IS NULL;

UPDATE orders_crm
SET
  pending_at = CASE
    WHEN order_status = 'pending' THEN COALESCE(updated_at, created_at)
    ELSE created_at
  END,
  processing_at = CASE
    WHEN order_status IN ('processing', 'ready_to_ship', 'shipped', 'completed', 'rts', 'problem') THEN COALESCE(updated_at, created_at)
    ELSE NULL
  END,
  last_update = COALESCE(updated_at, created_at)
WHERE pending_at IS NULL OR processing_at IS NULL OR last_update IS NULL;
