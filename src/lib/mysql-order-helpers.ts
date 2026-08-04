import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

type ExistingIdRow = RowDataPacket & {
  id: number;
};

type ExistingCustomerIdRow = RowDataPacket & {
  id: number;
};

type CustomerRow = RowDataPacket & {
  id: number;
  name: string | null;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  subdistrict: string | null;
  desa: string | null;
  province: string | null;
  city: string | null;
  age: number | null;
  complaint: string | null;
};

type CustomerAddressRow = RowDataPacket & {
  id: number;
  receiver_name: string | null;
  whatsapp_number: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  province: string | null;
};

type ProductRow = RowDataPacket & {
  id: number;
  product_name: string;
  weight_gram: number | null;
};

type GiftRow = RowDataPacket & {
  id: number;
  gift_name: string;
  weight_gram: number | null;
};

type BundleComponentRow = RowDataPacket & {
  bundle_id: number;
  bundle_name: string;
  product_id: number;
  product_name: string;
  weight_gram: number | null;
  qty: number;
};

type WarehouseCodeRow = RowDataPacket & {
  code: string | null;
  warehouse_name: string | null;
};

type CourierCodeRow = RowDataPacket & {
  code: string | null;
  courier_name: string | null;
};

export type ParsedRegion = {
  province: string;
  city: string;
  district: string;
};

export type UpsertCustomerInput = {
  customerId?: number | null;
  customerName: string;
  whatsapp: string;
  email?: string | null;
  address: string;
  subdistrict: string;
  desa?: string | null;
  age?: number | null;
  complaint?: string | null;
  region: ParsedRegion;
};

export type CustomerProfile = {
  id: number;
  name: string;
  whatsapp_number: string;
  email: string | null;
  address: string;
  subdistrict: string | null;
  desa: string | null;
  province: string | null;
  city: string | null;
  age: number | null;
  complaint: string | null;
};

export type CustomerAddressSnapshot = {
  id: number;
  receiver_name: string | null;
  whatsapp_number: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  province: string | null;
};

export type ResolvedBundleComponent = {
  productId: number;
  productName: string;
  weightGram: number;
  qtyPerBundle: number;
};

export type ResolvedOrderItem =
  | {
      kind: 'product';
      id: number;
      name: string;
      weightGram: number;
    }
  | {
      kind: 'gift';
      id: number;
      name: string;
      weightGram: number;
    }
  | {
      kind: 'bundle';
      id: number;
      name: string;
      components: ResolvedBundleComponent[];
    };

export function parseRegion(subdistrict: string): ParsedRegion {
  const parts = subdistrict
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    province: parts[0] || '-',
    city: parts[1] || '-',
    district: parts[2] || parts[0] || '-',
  };
}

export function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

const pad2 = (value: number) => String(value).padStart(2, '0');

function buildUniqueCode(prefix: string) {
  return `${prefix}${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

export async function generateUniqueCode(connection: PoolConnection, prefix = 'AKU') {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = buildUniqueCode(prefix);
    const [rows] = await connection.query<ExistingIdRow[]>(
      'SELECT id FROM orders WHERE unique_code = ? LIMIT 1',
      [candidate],
    );

    if (rows.length === 0) {
      return candidate;
    }
  }

  throw new Error('Gagal membuat unique code order. Silakan coba lagi.');
}

function getPaymentCode(paymentMethod: string) {
  switch (paymentMethod) {
    case 'cod':
      return 'C';
    case 'bank_transfer':
      return 'B';
    case 'ewallet':
      return 'E';
    case 'free':
      return 'F';
    default:
      return 'X';
  }
}

export async function generateLegacyOrderCode(
  connection: PoolConnection,
  payload: {
    tableName: 'orders' | 'orders_cso' | 'orders_crm' | 'orders_resend';
    codeColumn?: 'order_code' | 'unique_code';
    prefixLetter: 'C' | 'R' | 'D';
    warehouseId: number | null;
    courierName: string;
    paymentMethod: string;
  },
) {
  const now = new Date();
  const datePart = `${pad2(now.getFullYear() % 100)}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;

  let warehouseCode = 'X';
  if (payload.warehouseId) {
    const [warehouseRows] = await connection.query<WarehouseCodeRow[]>(
      'SELECT code, warehouse_name FROM warehouses WHERE id = ? LIMIT 1',
      [payload.warehouseId],
    );
    const warehouse = warehouseRows[0];
    warehouseCode = (warehouse?.code || warehouse?.warehouse_name || 'X').trim().charAt(0).toUpperCase() || 'X';
  }

  let courierCode = 'X';
  if (payload.courierName) {
    const [courierRows] = await connection.query<CourierCodeRow[]>(
      'SELECT code, courier_name FROM couriers WHERE courier_name = ? LIMIT 1',
      [payload.courierName],
    );
    const courier = courierRows[0];
    courierCode = (courier?.code || courier?.courier_name || payload.courierName || 'X').trim().charAt(0).toUpperCase() || 'X';
  }

  const paymentCode = getPaymentCode(payload.paymentMethod);
  const prefix = `${datePart}${payload.prefixLetter}${warehouseCode}${paymentCode}${courierCode}`;
  const codeColumn = payload.codeColumn || 'order_code';

  for (let sequence = 1; sequence <= 99; sequence += 1) {
    const candidate = `${prefix}A${pad2(sequence)}`;
    const [existingRows] = await connection.query<ExistingIdRow[]>(
      `SELECT id FROM ${payload.tableName} WHERE ${codeColumn} = ? LIMIT 1`,
      [candidate],
    );

    if (existingRows.length === 0) {
      return candidate;
    }
  }

  throw new Error(`Gagal membuat unique code ${payload.tableName}. Batas urutan harian sudah penuh.`);
}

export async function upsertCustomer(connection: PoolConnection, input: UpsertCustomerInput): Promise<CustomerProfile> {
  const requestedCustomerId = Number(input.customerId || 0);
  let customerId = requestedCustomerId > 0 ? requestedCustomerId : 0;

  if (!customerId && input.whatsapp) {
    const [existingByWa] = await connection.query<ExistingCustomerIdRow[]>(
      'SELECT id FROM customers WHERE whatsapp_number = ? ORDER BY id DESC LIMIT 1',
      [input.whatsapp],
    );
    customerId = existingByWa[0]?.id || 0;
  }

  if (customerId) {
    const [updateResult] = await connection.query<ResultSetHeader>(
      `
        UPDATE customers
        SET
          name = ?,
          whatsapp_number = ?,
          email = ?,
          address = ?,
          subdistrict = ?,
          desa = ?,
          province = ?,
          city = ?,
          age = ?,
          complaint = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        input.customerName,
        input.whatsapp,
        input.email || null,
        input.address,
        input.subdistrict,
        input.desa || null,
        input.region.province === '-' ? null : input.region.province,
        input.region.city === '-' ? null : input.region.city,
        input.age || null,
        input.complaint || null,
        customerId,
      ],
    );

    if (Number(updateResult.affectedRows || 0) === 0) {
      customerId = 0;
    }
  }

  if (!customerId && input.whatsapp) {
    const [existingByWa] = await connection.query<ExistingCustomerIdRow[]>(
      'SELECT id FROM customers WHERE whatsapp_number = ? ORDER BY id DESC LIMIT 1',
      [input.whatsapp],
    );
    customerId = existingByWa[0]?.id || 0;
  }

  if (!customerId) {
    const [result] = await connection.query<ResultSetHeader>(
      `
        INSERT INTO customers (
          name, whatsapp_number, email, address, subdistrict, desa, province, city, age, complaint, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `,
      [
        input.customerName,
        input.whatsapp,
        input.email || null,
        input.address,
        input.subdistrict,
        input.desa || null,
        input.region.province === '-' ? null : input.region.province,
        input.region.city === '-' ? null : input.region.city,
        input.age || null,
        input.complaint || null,
      ],
    );
    customerId = Number(result.insertId);
  }

  const [rows] = await connection.query<CustomerRow[]>(
    `
      SELECT
        id, name, whatsapp_number, email, address, subdistrict, desa, province, city, age, complaint
      FROM customers
      WHERE id = ?
      LIMIT 1
    `,
    [customerId],
  );

  const customer = rows[0];
  if (!customer) {
    throw new Error('Data customer gagal dimuat setelah disimpan.');
  }

  return {
    id: customer.id,
    name: customer.name || input.customerName,
    whatsapp_number: customer.whatsapp_number || input.whatsapp,
    email: customer.email || null,
    address: customer.address || input.address,
    subdistrict: customer.subdistrict || input.subdistrict,
    desa: customer.desa || null,
    province: customer.province || null,
    city: customer.city || null,
    age: customer.age || null,
    complaint: customer.complaint || null,
  };
}

export async function findCustomerById(connection: PoolConnection, customerId: number) {
  const [rows] = await connection.query<CustomerRow[]>(
    `
      SELECT
        id, name, whatsapp_number, email, address, subdistrict, desa, province, city, age, complaint
      FROM customers
      WHERE id = ?
      LIMIT 1
    `,
    [customerId],
  );

  return rows[0] || null;
}

export async function getCustomerAddressSnapshot(
  connection: PoolConnection,
  customerId: number,
  customerAddressId?: number | null,
) {
  if (customerAddressId) {
    const [rows] = await connection.query<CustomerAddressRow[]>(
      `
        SELECT id, receiver_name, whatsapp_number, address, district, city, province
        FROM customer_addresses
        WHERE id = ?
        LIMIT 1
      `,
      [customerAddressId],
    );
    return rows[0] || null;
  }

  const [rows] = await connection.query<CustomerAddressRow[]>(
    `
      SELECT id, receiver_name, whatsapp_number, address, district, city, province
      FROM customer_addresses
      WHERE customer_id = ?
      ORDER BY is_default DESC, id DESC
      LIMIT 1
    `,
    [customerId],
  );

  return rows[0] || null;
}

export async function upsertCustomerAddressSnapshot(
  connection: PoolConnection,
  input: {
    customerId: number;
    receiverName: string;
    whatsappNumber?: string | null;
    address: string;
    district?: string | null;
    city?: string | null;
    province?: string | null;
    customerAddressId?: number | null;
  },
) {
  const [defaultRows] = await connection.query<ExistingIdRow[]>(
    'SELECT id FROM customer_addresses WHERE customer_id = ? AND is_default = 1 LIMIT 1',
    [input.customerId],
  );

  if (input.customerAddressId) {
    await connection.query(
      `
        UPDATE customer_addresses
        SET
          customer_id = ?,
          receiver_name = ?,
          whatsapp_number = ?,
          address = ?,
          district = ?,
          city = ?,
          province = ?,
          is_default = ?
        WHERE id = ?
      `,
      [
        input.customerId,
        input.receiverName,
        input.whatsappNumber || null,
        input.address,
        input.district || null,
        input.city || null,
        input.province || null,
        defaultRows.length === 0 ? 1 : 0,
        input.customerAddressId,
      ],
    );
    return { id: input.customerAddressId };
  }

  const [result] = await connection.query<ResultSetHeader>(
    `
      INSERT INTO customer_addresses (
        customer_id, receiver_name, whatsapp_number, address, district, city, province, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.customerId,
      input.receiverName,
      input.whatsappNumber || null,
      input.address,
      input.district || null,
      input.city || null,
      input.province || null,
      defaultRows.length === 0 ? 1 : 0,
    ],
  );

  return { id: Number(result.insertId) };
}

export async function resolveOrderItem(
  connection: PoolConnection,
  input: { itemId: number; isGift: boolean; isBundle: boolean },
): Promise<ResolvedOrderItem> {
  if (!Number.isInteger(input.itemId) || input.itemId <= 0) {
    throw new Error('Produk yang dipilih tidak valid. Silakan muat ulang halaman lalu pilih ulang item.');
  }

  if (input.isGift) {
    const [rows] = await connection.query<GiftRow[]>(
      'SELECT id, gift_name, weight_gram FROM gifts WHERE id = ? LIMIT 1',
      [input.itemId],
    );
    const gift = rows[0];

    if (!gift) {
      throw new Error(`Hadiah dengan ID ${input.itemId} tidak ditemukan atau sudah dihapus.`);
    }

    return {
      kind: 'gift',
      id: gift.id,
      name: gift.gift_name,
      weightGram: Number(gift.weight_gram || 0),
    };
  }

  if (input.isBundle) {
    const [rows] = await connection.query<BundleComponentRow[]>(
      `
        SELECT
          pb.id AS bundle_id,
          pb.bundle_name,
          pbi.product_id,
          p.product_name,
          p.weight_gram,
          pbi.qty
        FROM product_bundles pb
        JOIN product_bundle_items pbi ON pbi.bundle_id = pb.id
        JOIN products p ON p.id = pbi.product_id
        WHERE pb.id = ?
        ORDER BY pbi.id ASC
      `,
      [input.itemId],
    );

    if (rows.length === 0) {
      throw new Error(`Bundling dengan ID ${input.itemId} tidak ditemukan atau sudah dihapus.`);
    }

    return {
      kind: 'bundle',
      id: rows[0].bundle_id,
      name: rows[0].bundle_name,
      components: rows.map((row) => ({
        productId: row.product_id,
        productName: row.product_name,
        weightGram: Number(row.weight_gram || 0),
        qtyPerBundle: row.qty,
      })),
    };
  }

  const [rows] = await connection.query<ProductRow[]>(
    'SELECT id, product_name, weight_gram FROM products WHERE id = ? LIMIT 1',
    [input.itemId],
  );
  const product = rows[0];

  if (!product) {
    throw new Error(`Produk dengan ID ${input.itemId} tidak ditemukan atau sudah dihapus.`);
  }

  return {
    kind: 'product',
    id: product.id,
    name: product.product_name,
    weightGram: Number(product.weight_gram || 0),
  };
}

export async function insertActivityLog(
  connection: PoolConnection,
  payload: {
    userId: number | null | undefined;
    action: string;
    target: string;
    details: string;
    ipAddress?: string | null;
  },
) {
  if (!payload.userId) {
    return;
  }

  await connection.query(
    `
      INSERT INTO activity_logs (user_id, action, target, details, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      payload.userId,
      payload.action,
      payload.target,
      payload.details,
      payload.ipAddress || null,
    ],
  );
}
