CREATE TABLE IF NOT EXISTS `orders` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `tanggal_proses` DATE DEFAULT NULL,
    `no_resi` VARCHAR(100) DEFAULT NULL,
    `order_timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `unique_code` VARCHAR(100) NOT NULL,
    `data_lengkap_pesanan` TEXT DEFAULT NULL,

    `first_name` VARCHAR(150) NOT NULL,
    `contact` VARCHAR(30) NOT NULL,
    `email` VARCHAR(150) DEFAULT NULL,

    `alamat` TEXT NOT NULL,
    `desa` VARCHAR(150) DEFAULT NULL,
    `kecamatan` VARCHAR(150) NOT NULL,
    `kota_kabupaten` VARCHAR(150) NOT NULL,
    `provinsi` VARCHAR(150) NOT NULL,

    `berat` DECIMAL(12,2) UNSIGNED NOT NULL DEFAULT 0.00,
    `jumlah_barang` INT UNSIGNED NOT NULL DEFAULT 0,
    `harga_barang` DECIMAL(15,2) UNSIGNED NOT NULL DEFAULT 0.00,

    `hadiah_bonus` TEXT DEFAULT NULL,
    `isi_paket` TEXT DEFAULT NULL,

    `cod_value` DECIMAL(15,2) UNSIGNED NOT NULL DEFAULT 0.00,
    `diskon_ekstra` DECIMAL(15,2) UNSIGNED NOT NULL DEFAULT 0.00,
    `ongkos_kirim` DECIMAL(15,2) UNSIGNED NOT NULL DEFAULT 0.00,
    `biaya_lainnya` DECIMAL(15,2) UNSIGNED NOT NULL DEFAULT 0.00,
    `total_pembayaran` DECIMAL(15,2) UNSIGNED NOT NULL DEFAULT 0.00,

    `keterangan` TEXT DEFAULT NULL,
    `catatan_internal` TEXT DEFAULT NULL,

    `ekspedisi` VARCHAR(100) DEFAULT NULL,
    `tipe_pembayaran` VARCHAR(50) DEFAULT NULL,
    `bukti_transfer` VARCHAR(255) DEFAULT NULL,

    `usia_customer` SMALLINT UNSIGNED DEFAULT NULL,
    `keluhan_customer` TEXT DEFAULT NULL,
    `keterangan_ninja` TEXT DEFAULT NULL,

    `product_name_1st` VARCHAR(200) DEFAULT NULL,
    `product_qty_1st` INT UNSIGNED DEFAULT NULL,
    `product_price_1st` DECIMAL(15,2) UNSIGNED DEFAULT NULL,

    `product_name_2nd` VARCHAR(200) DEFAULT NULL,
    `product_qty_2nd` INT UNSIGNED DEFAULT NULL,
    `product_price_2nd` DECIMAL(15,2) UNSIGNED DEFAULT NULL,

    `product_name_3rd` VARCHAR(200) DEFAULT NULL,
    `product_qty_3rd` INT UNSIGNED DEFAULT NULL,
    `product_price_3rd` DECIMAL(15,2) UNSIGNED DEFAULT NULL,

    `product_name_4th` VARCHAR(200) DEFAULT NULL,
    `product_qty_4th` INT UNSIGNED DEFAULT NULL,
    `product_price_4th` DECIMAL(15,2) UNSIGNED DEFAULT NULL,

    `product_name_5th` VARCHAR(200) DEFAULT NULL,
    `product_qty_5th` INT UNSIGNED DEFAULT NULL,
    `product_price_5th` DECIMAL(15,2) UNSIGNED DEFAULT NULL,

    `advertiser_name` VARCHAR(100) DEFAULT NULL,
    `sumber_iklan` VARCHAR(50) DEFAULT NULL,
    `scalev_order_id` VARCHAR(100) DEFAULT NULL,
    `promo` VARCHAR(150) DEFAULT NULL,

    `status_pesanan` VARCHAR(50) NOT NULL DEFAULT 'created',
    `customer_id` INT DEFAULT NULL,
    `customer_address_id` INT DEFAULT NULL,
    `order_type` VARCHAR(50) DEFAULT NULL,
    `order_source` VARCHAR(100) DEFAULT NULL,
    `warehouse_id` INT DEFAULT NULL,
    `courier_id` INT DEFAULT NULL,
    `pending_at` TIMESTAMP NULL DEFAULT NULL,
    `processing_at` TIMESTAMP NULL DEFAULT NULL,
    `last_update` TIMESTAMP NULL DEFAULT NULL,
    `is_ro` TINYINT(1) NOT NULL DEFAULT 0,
    `ro_count` INT NOT NULL DEFAULT 0,
    `additional_shipping_cost` DECIMAL(15,2) UNSIGNED NOT NULL DEFAULT 0.00,
    `shipping_discount` DECIMAL(15,2) UNSIGNED NOT NULL DEFAULT 0.00,
    `created_by` INT DEFAULT NULL,

    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_orders_unique_code` (`unique_code`),
    UNIQUE KEY `uk_orders_scalev_order_id` (`scalev_order_id`),

    KEY `idx_orders_no_resi` (`no_resi`),
    KEY `idx_orders_contact` (`contact`),
    KEY `idx_orders_order_timestamp` (`order_timestamp`),
    KEY `idx_orders_tanggal_proses` (`tanggal_proses`),
    KEY `idx_orders_status_pesanan` (`status_pesanan`),
    KEY `idx_orders_customer_id` (`customer_id`),
    KEY `idx_orders_order_source` (`order_source`),
    KEY `idx_orders_warehouse_id` (`warehouse_id`),
    KEY `idx_orders_created_by` (`created_by`),
    KEY `idx_orders_advertiser_name` (`advertiser_name`)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
