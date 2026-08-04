import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { emitEvent } from '@/lib/socket-server';
import { getMysqlPool, withMysqlTransaction } from '@/lib/mysql';
import {
  findCustomerById,
  generateUniqueCode,
  getCustomerAddressSnapshot,
  getTodayDateString,
  insertActivityLog,
  parseRegion,
} from '@/lib/mysql-order-helpers';

type OrderListRow = RowDataPacket & {
  id: number;
  order_code: string;
  scalev_order_id: string | null;
  customer_name: string;
  whatsapp_number: string;
  email: string | null;
  address: string;
  subdistrict: string;
  desa: string | null;
  total_product_price: number;
  product_discount: number;
  shipping_cost: number;
  other_fee: number;
  total_payment: number;
  order_status: string;
  courier_name: string | null;
  payment_method: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type CountRow = RowDataPacket & {
  total: number;
};

type ExistingOrderRow = RowDataPacket & {
  id: number;
  order_code: string;
  order_status: string;
};

type CustomerAddressLike = {
  address: string | null;
  district: string | null;
  city: string | null;
  province: string | null;
};

type OrderCreateBody = {
  customer_id: number;
  customer_address_id?: number;
  order_type?: string;
  order_source?: string;
  manual_order_code?: string;
  items: Array<{ product_id?: number | null; product_name: string; qty: number; price: number }>;
  product_discount?: number;
  shipping_cost?: number;
  other_fee?: number;
  notes?: string;
  payment_method?: string;
};

function getRegionString(source: CustomerAddressLike | null, fallbackSubdistrict: string | null) {
  if (source?.province || source?.city || source?.district) {
    return [source.province, source.city, source.district].filter(Boolean).join(', ');
  }

  return fallbackSubdistrict || '';
}

function getAddressValue(source: CustomerAddressLike | null, fallbackAddress: string | null) {
  return source?.address || fallbackAddress || '';
}

function getProductSlot(items: OrderCreateBody['items'], index: number) {
  const item = items[index] || null;
  return {
    name: item?.product_name || null,
    qty: item?.qty || null,
    price: item?.price || null,
  };
}

// GET /api/orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = (searchParams.get('status') || '').trim();
    const search = (searchParams.get('search') || '').trim();
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (status) {
      conditions.push('status_pesanan = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(unique_code LIKE ? OR COALESCE(scalev_order_id, \'\') LIKE ? OR first_name LIKE ? OR contact LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const pool = getMysqlPool();

    const [orders, totalRows] = await Promise.all([
      pool.query<OrderListRow[]>(
        `
          SELECT
            id,
            unique_code AS order_code,
            scalev_order_id,
            first_name AS customer_name,
            contact AS whatsapp_number,
            email,
            alamat AS address,
            CONCAT_WS(', ', provinsi, kota_kabupaten, kecamatan) AS subdistrict,
            desa,
            harga_barang AS total_product_price,
            diskon_ekstra AS product_discount,
            ongkos_kirim AS shipping_cost,
            biaya_lainnya AS other_fee,
            total_pembayaran AS total_payment,
            status_pesanan AS order_status,
            ekspedisi AS courier_name,
            tipe_pembayaran AS payment_method,
            created_at,
            updated_at
          FROM orders
          ${whereSql}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `,
        [...params, limit, offset],
      ),
      pool.query<CountRow[]>(
        `SELECT COUNT(*) AS total FROM orders ${whereSql}`,
        params,
      ),
    ]);

    return Response.json({
      success: true,
      data: orders[0],
      total: Number(totalRows[0][0]?.total || 0),
      page,
      limit,
    });
  } catch (error) {
    console.error('[API /orders GET]', error);
    return Response.json({ success: false, message: 'Gagal mengambil data pesanan' }, { status: 500 });
  }
}

// POST /api/orders
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const createdByUserId = Number(cookieStore.get('sahada_user_id')?.value || 0) || null;
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;

    const body = (await request.json()) as OrderCreateBody;
    const {
      customer_id,
      customer_address_id,
      manual_order_code,
      items,
      product_discount = 0,
      shipping_cost = 0,
      other_fee = 0,
      notes,
      payment_method = 'bank_transfer',
    } = body;

    if (!customer_id || !items?.length) {
      return Response.json({ success: false, message: 'Customer dan item wajib diisi' }, { status: 400 });
    }

    const scalevOrderId = manual_order_code?.trim() || null;
    if (scalevOrderId && scalevOrderId.length !== 13) {
      return Response.json({ success: false, message: 'ID Order (Scalev) harus tepat 13 karakter' }, { status: 400 });
    }

    const totalProductPrice = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
    const totalPayment = totalProductPrice - Number(product_discount || 0) + Number(shipping_cost || 0) + Number(other_fee || 0);

    const order = await withMysqlTransaction(async (connection) => {
      if (scalevOrderId) {
        const [existingScalev] = await connection.query<RowDataPacket[]>(
          'SELECT id FROM orders WHERE scalev_order_id = ? LIMIT 1',
          [scalevOrderId],
        );
        if (existingScalev.length > 0) {
          throw new Error('ID Order (Scalev) sudah digunakan.');
        }
      }

      const customer = await findCustomerById(connection, Number(customer_id));
      if (!customer) {
        throw new Error('Customer tidak ditemukan.');
      }

      const addressSnapshot = await getCustomerAddressSnapshot(connection, Number(customer_id), customer_address_id || null);
      const regionString = getRegionString(addressSnapshot, customer.subdistrict || '');
      const region = parseRegion(regionString);
      const addressValue = getAddressValue(addressSnapshot, customer.address || '');
      const uniqueCode = await generateUniqueCode(connection, 'ORD');
      const slots = Array.from({ length: 5 }, (_, index) => getProductSlot(items, index));

      const [insertOrderResult] = await connection.query<ResultSetHeader>(
        `
          INSERT INTO orders (
            tanggal_proses, unique_code, data_lengkap_pesanan,
            first_name, contact, email,
            alamat, desa, kecamatan, kota_kabupaten, provinsi,
            berat, jumlah_barang, harga_barang,
            isi_paket, cod_value, diskon_ekstra, ongkos_kirim, biaya_lainnya, total_pembayaran,
            catatan_internal, tipe_pembayaran, usia_customer, keluhan_customer,
            product_name_1st, product_qty_1st, product_price_1st,
            product_name_2nd, product_qty_2nd, product_price_2nd,
            product_name_3rd, product_qty_3rd, product_price_3rd,
            product_name_4th, product_qty_4th, product_price_4th,
            product_name_5th, product_qty_5th, product_price_5th,
            scalev_order_id, status_pesanan, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          getTodayDateString(),
          uniqueCode,
          JSON.stringify({
            source: body.order_source || 'api_orders',
            customer_id,
            customer_address_id: customer_address_id || null,
            order_type: body.order_type || 'normal',
            items,
            notes: notes || null,
          }),
          customer.name || 'Unknown',
          customer.whatsapp_number || '',
          customer.email || null,
          addressValue,
          customer.desa || null,
          region.district,
          region.city,
          region.province,
          0,
          items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
          totalProductPrice,
          items.map((item) => `${item.product_name} x${item.qty}`).join(', '),
          payment_method === 'cod' ? totalPayment : 0,
          product_discount,
          shipping_cost,
          other_fee,
          totalPayment,
          notes || null,
          payment_method,
          customer.age || null,
          customer.complaint || null,
          slots[0].name,
          slots[0].qty,
          slots[0].price,
          slots[1].name,
          slots[1].qty,
          slots[1].price,
          slots[2].name,
          slots[2].qty,
          slots[2].price,
          slots[3].name,
          slots[3].qty,
          slots[3].price,
          slots[4].name,
          slots[4].qty,
          slots[4].price,
          scalevOrderId,
          'pending',
          createdByUserId,
        ],
      );

      const orderId = Number(insertOrderResult.insertId);

      for (const item of items) {
        await connection.query(
          `
            INSERT INTO order_items (
              order_id, product_id, product_name, qty, price, discount, subtotal, is_gift, is_bundle
            ) VALUES (?, ?, ?, ?, ?, 0, ?, 0, 0)
          `,
          [
            orderId,
            item.product_id || null,
            item.product_name,
            Number(item.qty || 0),
            Number(item.price || 0),
            Number(item.price || 0) * Number(item.qty || 0),
          ],
        );
      }

      await connection.query(
        `
          INSERT INTO payments (
            order_id, payment_method, payment_status
          ) VALUES (?, ?, ?)
        `,
        [
          orderId,
          payment_method === 'cod' ? 'cod' : payment_method === 'free' ? 'free' : payment_method === 'ewallet' ? 'ewallet' : 'bank_transfer',
          payment_method === 'cod' ? 'unpaid' : 'unpaid',
        ],
      );

      await insertActivityLog(connection, {
        userId: createdByUserId,
        action: 'Create Pesanan',
        target: 'Pesanan',
        details: `Order: ${uniqueCode} | Source: API_ORDERS | Status Awal: pending | Pesanan dibuat`,
        ipAddress,
      });

      return { orderId, orderCode: uniqueCode };
    });

    await emitEvent('NEW_ORDER');
    await emitEvent('REFRESH_OLAHAN');

    return Response.json({
      success: true,
      message: 'Pesanan berhasil dibuat',
      data: { order_code: order.orderCode, order_id: order.orderId },
    });
  } catch (error) {
    console.error('[API /orders POST]', error);
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : 'Gagal membuat pesanan' },
      { status: 500 },
    );
  }
}

// PATCH /api/orders
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = Number(cookieStore.get('sahada_user_id')?.value || 0) || null;
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;
    const body = (await request.json()) as { id: number; order_status: string };
    const { id, order_status } = body;

    if (!id || !order_status) {
      return Response.json({ success: false, message: 'ID dan status wajib diisi' }, { status: 400 });
    }

    await withMysqlTransaction(async (connection) => {
      const [rows] = await connection.query<ExistingOrderRow[]>(
        `
          SELECT
            id,
            unique_code AS order_code,
            status_pesanan AS order_status
          FROM orders
          WHERE id = ?
          LIMIT 1
        `,
        [Number(id)],
      );

      const existingOrder = rows[0];
      if (!existingOrder) {
        throw new Error('Pesanan tidak ditemukan');
      }

      await connection.query(
        `
          UPDATE orders
          SET
            status_pesanan = ?,
            tanggal_proses = CASE
              WHEN ? = 'processing' AND tanggal_proses IS NULL THEN CURDATE()
              ELSE tanggal_proses
            END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [order_status, order_status, Number(id)],
      );

      if (existingOrder.order_status !== order_status) {
        await insertActivityLog(connection, {
          userId,
          action: 'Update Status Pesanan',
          target: 'Pesanan',
          details: `Order: ${existingOrder.order_code} | Source: API_ORDERS | Dari: ${existingOrder.order_status} | Ke: ${order_status}`,
          ipAddress,
        });
      }
    });

    await emitEvent('NEW_ORDER');
    await emitEvent('REFRESH_OLAHAN');

    return Response.json({ success: true, message: 'Status pesanan diperbarui' });
  } catch (error) {
    console.error('[API /orders PATCH]', error);
    const message = error instanceof Error ? error.message : 'Gagal memperbarui status';
    const statusCode = message === 'Pesanan tidak ditemukan' ? 404 : 500;
    return Response.json({ success: false, message }, { status: statusCode });
  }
}
