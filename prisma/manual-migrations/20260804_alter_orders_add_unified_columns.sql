ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `customer_id` INT DEFAULT NULL AFTER `status_pesanan`,
  ADD COLUMN IF NOT EXISTS `customer_address_id` INT DEFAULT NULL AFTER `customer_id`,
  ADD COLUMN IF NOT EXISTS `order_type` VARCHAR(50) DEFAULT NULL AFTER `customer_address_id`,
  ADD COLUMN IF NOT EXISTS `order_source` VARCHAR(100) DEFAULT NULL AFTER `order_type`,
  ADD COLUMN IF NOT EXISTS `warehouse_id` INT DEFAULT NULL AFTER `order_source`,
  ADD COLUMN IF NOT EXISTS `courier_id` INT DEFAULT NULL AFTER `warehouse_id`,
  ADD COLUMN IF NOT EXISTS `pending_at` TIMESTAMP NULL DEFAULT NULL AFTER `courier_id`,
  ADD COLUMN IF NOT EXISTS `processing_at` TIMESTAMP NULL DEFAULT NULL AFTER `pending_at`,
  ADD COLUMN IF NOT EXISTS `last_update` TIMESTAMP NULL DEFAULT NULL AFTER `updated_at`,
  ADD COLUMN IF NOT EXISTS `is_ro` TINYINT(1) NOT NULL DEFAULT 0 AFTER `last_update`,
  ADD COLUMN IF NOT EXISTS `ro_count` INT NOT NULL DEFAULT 0 AFTER `is_ro`,
  ADD COLUMN IF NOT EXISTS `additional_shipping_cost` DECIMAL(15,2) UNSIGNED NOT NULL DEFAULT 0.00 AFTER `biaya_lainnya`,
  ADD COLUMN IF NOT EXISTS `shipping_discount` DECIMAL(15,2) UNSIGNED NOT NULL DEFAULT 0.00 AFTER `additional_shipping_cost`;

ALTER TABLE `orders`
  ADD INDEX IF NOT EXISTS `idx_orders_customer_id` (`customer_id`),
  ADD INDEX IF NOT EXISTS `idx_orders_order_source` (`order_source`),
  ADD INDEX IF NOT EXISTS `idx_orders_warehouse_id` (`warehouse_id`);
