import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import crypto from 'crypto';
import { syncOrderTimestampColumns } from '@/lib/orderTimestamps';
import { logOrderStatusChange } from '@/lib/orderStatusLog';
import { upsertCustomerAddressSnapshot } from '@/lib/customerAddress';
import { saveUploadBuffer } from '@/lib/uploadStorage';

export const dynamic = 'force-dynamic';

type Source = 'CSO' | 'CSO_AUTO' | 'CRM';
type ItemInput = { product_id: number; product_name?: string; qty: number; price: number; discount: number; is_gift: boolean; is_bundle: boolean };
type LookupRow = { id: number; product_name: string; image_url?: string | null };
type EditableItemRow = {
  id?: number;
  product_id: number | null;
  product_name: string;
  qty: number;
  price: number;
  discount: number;
  is_gift: boolean | number | null;
  is_bundle: boolean | number | null;
  image_url?: string | null;
};

type ProductSummary = {
  name: string;
  qty: number;
  price: number;
};

const tableMap = {
  CSO: { orders: 'orders', items: 'order_items', payments: 'payments', shipments: 'shipments' },
  CSO_AUTO: { orders: 'orders_cso', items: 'order_items_cso', payments: 'payments_cso', shipments: 'shipments_cso' },
  CRM: { orders: 'orders_crm', items: 'order_items_crm', payments: 'payments_crm', shipments: 'shipments_crm' },
} as const;

function sourceOf(value: string | null): Source | null {
  return value === 'CSO' || value === 'CSO_AUTO' || value === 'CRM' ? value : null;
}

function safeJson(data: unknown) {
  return JSON.parse(JSON.stringify(data, (_, value) => typeof value === 'bigint' ? Number(value) : value));
}

function summarizeItems(items: ProductSummary[]) {
  return items.map((item) => `${item.name} x${item.qty}`).join(', ') || null;
}

function getProductSlot(items: ProductSummary[], index: number) {
  const item = items[index] || null;

  return {
    name: item?.name || null,
    qty: item?.qty || null,
    price: item?.price || null,
  };
}

function usesProductForeignKey(source: Source) {
  return source === 'CSO' || source === 'CSO_AUTO';
}

function normalizeEditableItems(
  source: Source,
  rows: EditableItemRow[],
  products: LookupRow[],
  gifts: LookupRow[],
  bundles: LookupRow[],
) {
  const productById = new Map(products.map((item) => [Number(item.id), item]));
  const giftByName = new Map(gifts.map((item) => [String(item.product_name).trim().toLowerCase(), item]));
  const bundleByName = new Map(bundles.map((item) => [String(item.product_name).trim().toLowerCase(), item]));

  return rows.map((row) => {
    const isGift = Boolean(row.is_gift);
    const isBundle = Boolean(row.is_bundle);
    const itemNameKey = String(row.product_name || '').trim().toLowerCase();
    const rawProductId = Number(row.product_id || 0);

    if (isGift) {
      const matchedGift = rawProductId > 0 ? gifts.find((item) => Number(item.id) === rawProductId) : giftByName.get(itemNameKey);
      return {
        ...row,
        product_id: matchedGift ? Number(matchedGift.id) : (rawProductId > 0 ? rawProductId : null),
        image_url: row.image_url || matchedGift?.image_url || null,
      };
    }

    if (isBundle) {
      const matchedProduct = productById.get(rawProductId);
      if (matchedProduct) {
        // Legacy CSO bundle rows were stored as expanded product components.
        return {
          ...row,
          is_bundle: false,
          product_id: rawProductId,
          image_url: row.image_url || matchedProduct.image_url || null,
        };
      }

      const matchedBundle = rawProductId > 0 ? bundles.find((item) => Number(item.id) === rawProductId) : bundleByName.get(itemNameKey);
      return {
        ...row,
        product_id: matchedBundle ? Number(matchedBundle.id) : (rawProductId > 0 ? rawProductId : null),
        image_url: row.image_url || matchedBundle?.image_url || null,
      };
    }

    return {
      ...row,
      product_id: rawProductId > 0 ? rawProductId : null,
    };
  });
}

async function resolveItemReferenceId(
  tx: Prisma.TransactionClient,
  item: { product_id?: number | null; product_name?: string | null; is_gift: boolean | number | null; is_bundle: boolean | number | null },
) {
  const rawProductId = Number(item.product_id || 0);
  if (rawProductId > 0) {
    return rawProductId;
  }

  const name = String(item.product_name || '').trim();
  if (!name) {
    return null;
  }

  if (Boolean(item.is_gift)) {
    const gift = await tx.gifts.findFirst({
      where: { gift_name: { equals: name } },
      select: { id: true },
    });
    return gift?.id ?? null;
  }

  if (Boolean(item.is_bundle)) {
    const bundle = await tx.product_bundles.findFirst({
      where: { bundle_name: { equals: name } },
      select: { id: true },
    });
    return bundle?.id ?? null;
  }

  const product = await tx.products.findFirst({
    where: { product_name: { equals: name } },
    select: { id: true },
  });
  return product?.id ?? null;
}

async function hasColumn(tableName: string, columnName: string) {
  const rows = await prisma.$queryRaw<Array<{ total: bigint | number }>>`
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${tableName}
      AND COLUMN_NAME = ${columnName}
  `;

  return Number(rows[0]?.total || 0) > 0;
}

async function resolveOrder(id: string, source: Source) {
  const t = tableMap[source];
  const orderCodeColumn = source === 'CSO' ? 'unique_code' : 'order_code';
  let rows = await prisma.$queryRawUnsafe<any[]>(`SELECT id, ${orderCodeColumn} AS order_code FROM ${t.orders} WHERE ${orderCodeColumn} = ? LIMIT 1`, id);
  if (!rows.length && /^\d+$/.test(id)) rows = await prisma.$queryRawUnsafe<any[]>(`SELECT id, ${orderCodeColumn} AS order_code FROM ${t.orders} WHERE id = ? LIMIT 1`, Number(id));
  return rows[0] || null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const source = sourceOf(url.searchParams.get('source'));
    const identifier = url.searchParams.get('id')?.trim();
    if (!source || !identifier) return NextResponse.json({ status: 'error', message: 'ID atau sumber pesanan tidak valid' }, { status: 400 });

    const resolved = await resolveOrder(identifier, source);
    if (!resolved) return NextResponse.json({ status: 'error', message: 'Pesanan tidak ditemukan' }, { status: 404 });
    const t = tableMap[source];
    const orderId = Number(resolved.id);

    const hasNoShippingCost = await hasColumn('no_payment_methods', 'no_shipping_cost');
    const [orders, rawItems, payments, shipments, products, gifts, bundles, warehouses, couriers, promos, advertisers, adSources, paymentAccounts, noPaymentMethods, productStocks, giftStocks, editLogs, bundleItems] = await Promise.all([
      source === 'CSO'
        ? prisma.$queryRawUnsafe<any[]>(
            `SELECT
              o.id,
              o.unique_code AS order_code,
              o.status_pesanan AS order_status,
              o.customer_id,
              o.customer_address_id,
              o.first_name AS customer_name,
              o.contact AS whatsapp_number,
              o.email,
              o.alamat AS address,
              o.provinsi AS province,
              o.kota_kabupaten AS city,
              CONCAT_WS(', ', COALESCE(ca.province, c.province, o.provinsi), COALESCE(ca.city, c.city, o.kota_kabupaten), COALESCE(ca.district, o.kecamatan)) AS subdistrict,
              COALESCE(ca.receiver_name, c.name, o.first_name) AS customer_name,
              COALESCE(ca.whatsapp_number, c.whatsapp_number, o.contact) AS whatsapp_number,
              COALESCE(ca.address, c.address, o.alamat) AS address,
              COALESCE(ca.province, c.province, o.provinsi) AS province,
              COALESCE(ca.city, c.city, o.kota_kabupaten) AS city,
              COALESCE(c.desa, o.desa) AS desa,
              COALESCE(c.age, o.usia_customer) AS age,
              COALESCE(c.complaint, o.keluhan_customer) AS complaint,
              o.harga_barang AS total_product_price,
              o.diskon_ekstra AS product_discount,
              o.ongkos_kirim AS shipping_cost,
              o.additional_shipping_cost,
              o.shipping_discount,
              o.biaya_lainnya AS other_fee,
              o.total_pembayaran AS total_payment,
              o.keterangan AS notes,
              o.warehouse_id,
              o.courier_id,
              o.advertiser_name,
              o.sumber_iklan AS ad_source,
              o.promo AS promo_id,
              o.order_source,
              o.is_ro,
              o.ro_count
            FROM ${t.orders} o
            LEFT JOIN customers c ON c.id = o.customer_id
            LEFT JOIN customer_addresses ca ON ca.id = o.customer_address_id
            WHERE o.id = ?
            LIMIT 1`,
            orderId,
          )
        : prisma.$queryRawUnsafe<any[]>(`SELECT o.*, COALESCE(ca.receiver_name, c.name) customer_name, COALESCE(ca.whatsapp_number, c.whatsapp_number) whatsapp_number, c.email, COALESCE(ca.address, c.address) address, COALESCE(ca.province, c.province) province, COALESCE(ca.city, c.city) city, COALESCE(NULLIF(CONCAT_WS(',', ca.province, ca.city, ca.district), ''), c.subdistrict) subdistrict, c.desa, c.age, c.complaint FROM ${t.orders} o LEFT JOIN customers c ON c.id=o.customer_id LEFT JOIN customer_addresses ca ON ca.id=o.customer_address_id WHERE o.id=? LIMIT 1`, orderId),
      source === 'CSO'
        ? prisma.$queryRawUnsafe<any[]>(`SELECT oi.*, COALESCE(p.image_url, g.image_url) image_url FROM ${t.items} oi LEFT JOIN products p ON p.id = oi.product_id AND COALESCE(oi.is_gift, 0) = 0 LEFT JOIN gifts g ON g.gift_name = oi.product_name AND oi.is_gift = 1 WHERE oi.order_id = ?`, orderId)
        : prisma.$queryRawUnsafe<any[]>(`SELECT oi.*, COALESCE(pb.image_url,p.image_url,g.image_url) image_url FROM ${t.items} oi LEFT JOIN products p ON p.id=oi.product_id AND COALESCE(oi.is_gift,0)=0 AND COALESCE(oi.is_bundle,0)=0 LEFT JOIN gifts g ON g.id=oi.product_id AND oi.is_gift=1 LEFT JOIN product_bundles pb ON pb.id=oi.product_id AND oi.is_bundle=1 WHERE oi.order_id=?`, orderId),
      prisma.$queryRawUnsafe<any[]>(`SELECT * FROM ${t.payments} WHERE order_id=? LIMIT 1`, orderId),
      prisma.$queryRawUnsafe<any[]>(`SELECT * FROM ${t.shipments} WHERE order_id=? LIMIT 1`, orderId),
      prisma.$queryRawUnsafe<any[]>(`SELECT p.id,p.product_name,p.price,p.weight_gram,p.image_url,COALESCE(SUM(ws.stock),0) total_stock FROM products p LEFT JOIN warehouse_stock ws ON ws.product_id=p.id WHERE p.status='active' GROUP BY p.id ORDER BY p.product_name`),
      prisma.$queryRawUnsafe<any[]>(`SELECT g.id,g.gift_name product_name,0 price,g.weight_gram,g.image_url,COALESCE(SUM(ws.stock),0) total_stock FROM gifts g LEFT JOIN warehouse_gift_stock ws ON ws.gift_id=g.id WHERE g.status='active' GROUP BY g.id ORDER BY g.gift_name`),
      prisma.$queryRawUnsafe<any[]>(`SELECT id,bundle_name product_name,price,image_url FROM product_bundles WHERE status='active' ORDER BY bundle_name`),
      prisma.warehouses.findMany({ orderBy: { warehouse_name: 'asc' } }),
      prisma.couriers.findMany({ orderBy: { courier_name: 'asc' } }),
      prisma.promos.findMany({ where: { status: 'active' }, orderBy: { promo_name: 'asc' } }),
      prisma.advertisers.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } }),
      prisma.ad_sources.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } }),
      prisma.payment_accounts.findMany({ orderBy: { id: 'asc' } }),
      prisma.$queryRawUnsafe<any[]>(
        hasNoShippingCost
          ? 'SELECT id, method_name, description, is_active, no_shipping_cost FROM no_payment_methods WHERE is_active = 1 ORDER BY method_name ASC'
          : 'SELECT id, method_name, description, is_active, 0 AS no_shipping_cost FROM no_payment_methods WHERE is_active = 1 ORDER BY method_name ASC'
      ),
      prisma.warehouse_stock.findMany(),
      prisma.warehouse_gift_stock.findMany(),
      prisma.activity_logs.findMany({
        where: {
          action: {
            in: ['Edit Pesanan', 'Update Status Pesanan', 'Create Pesanan'],
          },
          details: {
            contains: resolved.order_code,
          },
        },
        include: {
          users: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        take: 10,
      }),
      prisma.$queryRawUnsafe<any[]>(`SELECT pbi.bundle_id, pbi.product_id, pbi.qty, p.product_name, p.image_url FROM product_bundle_items pbi LEFT JOIN products p ON p.id = pbi.product_id`),
    ]);

    const order = orders[0];
    if (!order) return NextResponse.json({ status: 'error', message: 'Pesanan tidak ditemukan' }, { status: 404 });
    if (!order.warehouse_id && shipments[0]?.warehouse_id) order.warehouse_id = shipments[0].warehouse_id;
    if (!order.courier_id && shipments[0]?.courier_name) order.courier_name = shipments[0].courier_name;
    const items = normalizeEditableItems(source, rawItems, products, gifts, bundles);

    bundles.forEach((b: any) => {
      b.components = bundleItems.filter((i: any) => i.bundle_id === b.id).map((i: any) => ({
        product_id: i.product_id,
        qty: i.qty,
        product_name: i.product_name,
        image_url: i.image_url
      }));
    });

    const normalizedNoPaymentMethods = noPaymentMethods.map((item: any) => ({
      ...item,
      is_active: Boolean(item.is_active),
      no_shipping_cost: Boolean(item.no_shipping_cost),
    }));

    return NextResponse.json(safeJson({
      status: 'success',
      data: {
        source,
        order,
        items,
        payment: payments[0] || null,
        shipment: shipments[0] || null,
        products,
        gifts,
        bundles,
        warehouses,
        couriers,
        promos,
        advertisers,
        adSources,
        paymentAccounts,
        noPaymentMethods: normalizedNoPaymentMethods,
        productStocks,
        giftStocks,
        editLogs: editLogs.map((row) => ({
          id: row.id,
          action: row.action,
          details: row.details,
          created_at: row.created_at,
          user_name: row.users?.name || null,
        })),
      },
    }));
  } catch (error: any) {
    console.error('GET olahan edit:', error);
    return NextResponse.json({ status: 'error', message: error.message || 'Gagal memuat pesanan' }, { status: 500 });
  }
}

async function saveProof(file: File | null) {
  if (!file || !file.size) return null;
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) throw new Error('Bukti pembayaran harus berupa JPG, PNG, atau WEBP');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const name = `proof_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const stored = await saveUploadBuffer(['payments'], name, Buffer.from(await file.arrayBuffer()));
  return stored.url;
}

export async function PUT(request: Request) {
  try {
    const form = await request.formData();
    const payload = JSON.parse(String(form.get('payload') || '{}'));
    if (payload.payment_status) {
      payload.payment_status = payload.payment_status.toLowerCase();
      if (payload.payment_status === 'pending') payload.payment_status = 'unpaid';
    }
    if (payload.payment_method) payload.payment_method = payload.payment_method.toLowerCase();
    const source = sourceOf(payload.source);
    const identifier = String(payload.id || '').trim();
    if (!source || !identifier) return NextResponse.json({ status: 'error', message: 'ID atau sumber pesanan tidak valid' }, { status: 400 });

    const resolved = await resolveOrder(identifier, source);
    if (!resolved) return NextResponse.json({ status: 'error', message: 'Pesanan tidak ditemukan' }, { status: 404 });
    const t = tableMap[source];
    const nextOrderCode = String(payload.order_code || '').trim().toUpperCase();
    if (!nextOrderCode) return NextResponse.json({ status: 'error', message: 'ID pesanan wajib diisi' }, { status: 400 });

    const duplicateOrder = source === 'CSO'
      ? await prisma.$queryRawUnsafe<any[]>(`SELECT id FROM ${t.orders} WHERE unique_code = ? AND id <> ? LIMIT 1`, nextOrderCode, Number(resolved.id))
      : await prisma.$queryRawUnsafe<any[]>(`SELECT id FROM ${t.orders} WHERE order_code = ? AND id <> ? LIMIT 1`, nextOrderCode, Number(resolved.id));
    if (duplicateOrder.length) return NextResponse.json({ status: 'error', message: 'ID pesanan sudah digunakan. Gunakan ID lain.' }, { status: 400 });

    const proofUrl = await saveProof(form.get('payment_proof') as File | null);
    const updatedAt = new Date();
    const cookieStore = await cookies();
    const userId = Number(cookieStore.get('sahada_user_id')?.value || 0);
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
    const orderId = Number(resolved.id);
    const items = (payload.items || []) as ItemInput[];
    if (!items.length) return NextResponse.json({ status: 'error', message: 'Pesanan harus memiliki minimal satu produk atau hadiah' }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      const oldOrders = source === 'CSO'
        ? await tx.$queryRawUnsafe<any[]>(`SELECT warehouse_id, customer_id, customer_address_id, status_pesanan AS order_status, unique_code AS order_code FROM ${t.orders} WHERE id=? FOR UPDATE`, orderId)
        : await tx.$queryRawUnsafe<any[]>(`SELECT warehouse_id, customer_id, customer_address_id, order_status, order_code FROM ${t.orders} WHERE id=? FOR UPDATE`, orderId);
      const old = oldOrders[0];
      if (!old) throw new Error('Pesanan tidak ditemukan');
      const oldItems = await tx.$queryRawUnsafe<any[]>(`SELECT product_id,product_name,qty,is_gift,is_bundle FROM ${t.items} WHERE order_id=?`, orderId);
      if (old.warehouse_id) {
        for (const item of oldItems) {
          if (Number(item.is_bundle)) {
            const bundleId = await resolveItemReferenceId(tx, item);
            if (!bundleId) throw new Error(`Bundling lama "${item.product_name || '-'}" tidak dapat dipetakan kembali.`);
            const parts = await tx.$queryRawUnsafe<any[]>(`SELECT product_id,qty FROM product_bundle_items WHERE bundle_id=?`, bundleId);
            for (const part of parts) await tx.$executeRawUnsafe(`UPDATE warehouse_stock SET stock=stock+? WHERE product_id=? AND warehouse_id=?`, Number(part.qty) * Number(item.qty), part.product_id, old.warehouse_id);
          } else if (Number(item.is_gift)) {
            const giftId = await resolveItemReferenceId(tx, item);
            if (!giftId) throw new Error(`Hadiah lama "${item.product_name || '-'}" tidak dapat dipetakan kembali.`);
            await tx.$executeRawUnsafe(`UPDATE warehouse_gift_stock SET stock=stock+? WHERE gift_id=? AND warehouse_id=?`, Number(item.qty), giftId, old.warehouse_id);
          } else {
            await tx.$executeRawUnsafe(`UPDATE warehouse_stock SET stock=stock+? WHERE product_id=? AND warehouse_id=?`, Number(item.qty), item.product_id, old.warehouse_id);
          }
        }
      }

      const region = String(payload.subdistrict || '');
      const regionParts = region.split(',').map((x: string) => x.trim());
      let customerId = Number(old.customer_id || 0);

      if (!customerId) {
        const existingCustomer = payload.whatsapp_number
          ? await tx.$queryRawUnsafe<Array<{ id: number }>>(
              'SELECT id FROM customers WHERE whatsapp_number = ? ORDER BY id DESC LIMIT 1',
              payload.whatsapp_number,
            )
          : [];

        if (existingCustomer.length > 0) {
          customerId = Number(existingCustomer[0].id);
        } else {
          const createdCustomer = await tx.customers.create({
            data: {
              name: payload.customer_name,
              whatsapp_number: payload.whatsapp_number || null,
              email: payload.email || null,
              status: 'active',
              address: payload.address || null,
              subdistrict: region || null,
              desa: payload.desa || null,
              age: payload.age === '' ? null : Number(payload.age),
              complaint: payload.complaint || null,
              province: regionParts[0] || null,
              city: regionParts[1] || null,
              created_at: updatedAt,
              updated_at: updatedAt,
            },
            select: {
              id: true,
            },
          });

          customerId = Number(createdCustomer.id);
        }

        await tx.$executeRawUnsafe(`UPDATE ${t.orders} SET customer_id=? WHERE id=?`, customerId, orderId);
      }

      await tx.$executeRawUnsafe(`UPDATE customers SET name=?,whatsapp_number=?,email=?,address=?,subdistrict=?,desa=?,age=?,complaint=?,province=?,city=?,updated_at=? WHERE id=?`, payload.customer_name, payload.whatsapp_number, payload.email || null, payload.address, region, payload.desa || null, payload.age === '' ? null : Number(payload.age), payload.complaint || null, regionParts[0] || null, regionParts[1] || null, updatedAt, customerId);
      const customerAddress = await upsertCustomerAddressSnapshot(tx, {
        customerId,
        customerAddressId: old.customer_address_id ? Number(old.customer_address_id) : null,
        receiverName: payload.customer_name,
        whatsappNumber: payload.whatsapp_number,
        address: payload.address,
        district: regionParts[2] || null,
        city: regionParts[1] || null,
        province: regionParts[0] || null,
      });
      if (!old.customer_address_id || Number(old.customer_address_id) !== customerAddress.id) {
        await tx.$executeRawUnsafe(`UPDATE ${t.orders} SET customer_address_id=? WHERE id=?`, customerAddress.id, orderId);
      }

      let courierId: number | null = payload.courier_id ? Number(payload.courier_id) : null;
      let courier: any = null;
      if (courierId) courier = (await tx.$queryRawUnsafe<any[]>(`SELECT * FROM couriers WHERE id=?`, courierId))[0];
      const warehouseId = payload.warehouse_id ? Number(payload.warehouse_id) : null;
      const roCount = Number(payload.ro_count || 0);
      const nextOrderStatus = 'pending';
      const packageItems = items.filter((item) => !item.is_gift).map((item) => ({
        name: item.product_name || '',
        qty: Number(item.qty || 0),
        price: Number(item.price || 0),
      }));
      const giftItems = items.filter((item) => item.is_gift).map((item) => ({
        name: item.product_name || '',
        qty: Number(item.qty || 0),
        price: 0,
      }));
      const totalQty = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
      const productSlots = Array.from({ length: 5 }, (_, index) => getProductSlot(packageItems, index));

      if (source === 'CSO') {
        await tx.$executeRawUnsafe(
          `UPDATE ${t.orders} SET unique_code=?, status_pesanan=?, harga_barang=?, diskon_ekstra=?, ongkos_kirim=?, additional_shipping_cost=?, shipping_discount=?, biaya_lainnya=?, total_pembayaran=?, keterangan=?, warehouse_id=?, courier_id=?, promo=?, advertiser_name=?, sumber_iklan=?, updated_at=?, first_name=?, contact=?, email=?, alamat=?, kecamatan=?, kota_kabupaten=?, provinsi=?, desa=?, usia_customer=?, keluhan_customer=?, customer_id=?, jumlah_barang=?, hadiah_bonus=?, isi_paket=?, product_name_1st=?, product_qty_1st=?, product_price_1st=?, product_name_2nd=?, product_qty_2nd=?, product_price_2nd=?, product_name_3rd=?, product_qty_3rd=?, product_price_3rd=?, product_name_4th=?, product_qty_4th=?, product_price_4th=?, product_name_5th=?, product_qty_5th=?, product_price_5th=?, is_ro=?, ro_count=? WHERE id=?`,
          nextOrderCode,
          nextOrderStatus,
          Number(payload.total_product_price),
          Number(payload.product_discount),
          Number(payload.shipping_cost),
          Number(payload.manual_fee_cod),
          Number(payload.shipping_discount || 0),
          Number(payload.other_fee),
          Number(payload.total_payment),
          payload.notes || null,
          warehouseId,
          courierId,
          payload.promo_id || null,
          payload.advertiser_name || null,
          payload.ad_source || null,
          updatedAt,
          payload.customer_name,
          payload.whatsapp_number,
          payload.email || null,
          payload.address,
          regionParts[2] || null,
          regionParts[1] || null,
          regionParts[0] || null,
          payload.desa || null,
          payload.age === '' ? null : Number(payload.age),
          payload.complaint || null,
          customerId,
          totalQty,
          summarizeItems(giftItems),
          summarizeItems(packageItems),
          productSlots[0].name,
          productSlots[0].qty,
          productSlots[0].price,
          productSlots[1].name,
          productSlots[1].qty,
          productSlots[1].price,
          productSlots[2].name,
          productSlots[2].qty,
          productSlots[2].price,
          productSlots[3].name,
          productSlots[3].qty,
          productSlots[3].price,
          productSlots[4].name,
          productSlots[4].qty,
          productSlots[4].price,
          roCount > 0 ? 1 : 0,
          roCount,
          orderId,
        );
      } else {
        await tx.$executeRawUnsafe(`UPDATE ${t.orders} SET order_code=?, order_status=?,total_product_price=?,product_discount=?,shipping_cost=?,additional_shipping_cost=?,shipping_discount=?,other_fee=?,total_payment=?,notes=?,warehouse_id=?,courier_id=?,is_ro=?,ro_count=?,promo_id=?,updated_at=? WHERE id=?`, nextOrderCode, nextOrderStatus, Number(payload.total_product_price), Number(payload.product_discount), Number(payload.shipping_cost), Number(payload.manual_fee_cod), Number(payload.shipping_discount || 0), Number(payload.other_fee), Number(payload.total_payment), payload.notes || null, warehouseId, courierId, roCount > 0 ? 1 : 0, roCount, payload.promo_id || null, updatedAt, orderId);
      }

      await syncOrderTimestampColumns(tx, t.orders, orderId, nextOrderStatus, updatedAt);
      const logOrderCode = nextOrderCode || old.order_code || resolved.order_code;
      await logOrderStatusChange(tx, { userId, orderCode: logOrderCode, source, fromStatus: old.order_status, toStatus: nextOrderStatus, ipAddress, reason: old.order_status === nextOrderStatus ? 'Status disimpan ulang saat edit pesanan' : 'Status diperbarui saat edit pesanan' });

      if (courier) {
        const ship = await tx.$queryRawUnsafe<any[]>(`SELECT id FROM ${t.shipments} WHERE order_id=?`, orderId);
        if (ship.length) await tx.$executeRawUnsafe(`UPDATE ${t.shipments} SET courier_name=?,courier_service=?,warehouse_id=?,shipping_cost=? WHERE order_id=?`, courier.courier_name, courier.service_type || 'Reguler', warehouseId, Number(payload.shipping_cost), orderId);
        else await tx.$executeRawUnsafe(`INSERT INTO ${t.shipments}(order_id,warehouse_id,courier_name,courier_service,shipping_cost) VALUES(?,?,?,?,?)`, orderId, warehouseId, courier.courier_name, courier.service_type || 'Reguler', Number(payload.shipping_cost));
      }

      let bankName = null, accountName = null, accountNumber = null;
      if (payload.payment_method === 'bank_transfer' && payload.payment_account_id) {
        const account = (await tx.$queryRawUnsafe<any[]>(`SELECT * FROM payment_accounts WHERE id=?`, Number(payload.payment_account_id)))[0];
        if (account) {
          bankName = account.bank_name;
          accountName = account.account_name;
          accountNumber = account.account_number;
        }
      } else if (payload.payment_method === 'free' && payload.no_payment_method_id) {
        const method = (await tx.$queryRawUnsafe<any[]>(`SELECT * FROM no_payment_methods WHERE id=?`, Number(payload.no_payment_method_id)))[0];
        if (method) {
          bankName = method.method_name;
          accountName = 'No Payment';
          accountNumber = '-';
        }
      }

      const pay = await tx.$queryRawUnsafe<any[]>(`SELECT id FROM ${t.payments} WHERE order_id=?`, orderId);
      if (pay.length) {
        if (proofUrl) await tx.$executeRawUnsafe(`UPDATE ${t.payments} SET payment_status='waiting_confirmation',reject_reason=NULL,payment_method=?,payment_proof_url=?,bank_name=?,account_name=?,account_number=?,fat_proof_url=? WHERE order_id=?`, payload.payment_method, proofUrl, bankName, accountName, accountNumber, payload.id_reff || null, orderId);
        else await tx.$executeRawUnsafe(`UPDATE ${t.payments} SET payment_status=?,payment_method=?,bank_name=?,account_name=?,account_number=?,fat_proof_url=? WHERE order_id=?`, payload.payment_status, payload.payment_method, bankName, accountName, accountNumber, payload.id_reff || null, orderId);
      } else {
        await tx.$executeRawUnsafe(`INSERT INTO ${t.payments}(order_id,payment_method,payment_status,payment_proof_url,bank_name,account_name,account_number,fat_proof_url) VALUES(?,?,?,?,?,?,?,?)`, orderId, payload.payment_method, proofUrl ? 'waiting_confirmation' : payload.payment_status, proofUrl, bankName, accountName, accountNumber, payload.id_reff || null);
      }

      await tx.$executeRawUnsafe(`DELETE FROM ${t.items} WHERE order_id=?`, orderId);
      for (const raw of items) {
        const item = { ...raw, product_id: Number(raw.product_id), qty: Number(raw.qty), price: Number(raw.price), discount: Number(raw.discount || 0) };
        if (item.qty < 1) throw new Error('Jumlah item minimal 1');

        const referenceId = await resolveItemReferenceId(tx, item);
        if ((item.is_gift || item.is_bundle || item.product_id > 0) && !referenceId) {
          throw new Error('Produk atau hadiah tidak ditemukan');
        }

        const nameTable = item.is_gift ? ['gifts', 'gift_name'] : item.is_bundle ? ['product_bundles', 'bundle_name'] : ['products', 'product_name'];
        const found = (await tx.$queryRawUnsafe<any[]>(`SELECT ${nameTable[1]} name FROM ${nameTable[0]} WHERE id=?`, referenceId))[0];
        if (!found) throw new Error('Produk atau hadiah tidak ditemukan');

        const storedProductId = usesProductForeignKey(source) && (item.is_gift || item.is_bundle) ? null : referenceId;
        await tx.$executeRawUnsafe(`INSERT INTO ${t.items}(order_id,product_id,product_name,qty,price,discount,subtotal,is_gift,is_bundle) VALUES(?,?,?,?,?,?,?,?,?)`, orderId, storedProductId, found.name, item.qty, item.price, item.discount, (item.price - item.discount) * item.qty, item.is_gift ? 1 : 0, item.is_bundle ? 1 : 0);

        if (warehouseId) {
          if (item.is_bundle) {
            const parts = await tx.$queryRawUnsafe<any[]>(`SELECT product_id,qty FROM product_bundle_items WHERE bundle_id=?`, referenceId);
            for (const part of parts) {
              const need = Number(part.qty) * item.qty;
              const stock = (await tx.$queryRawUnsafe<any[]>(`SELECT stock FROM warehouse_stock WHERE product_id=? AND warehouse_id=? FOR UPDATE`, part.product_id, warehouseId))[0]?.stock ?? 0;
              if (Number(stock) < need) throw new Error(`Stok komponen bundling ${found.name} tidak mencukupi`);
              await tx.$executeRawUnsafe(`UPDATE warehouse_stock SET stock=stock-? WHERE product_id=? AND warehouse_id=?`, need, part.product_id, warehouseId);
            }
          } else {
            const stockTable = item.is_gift ? 'warehouse_gift_stock' : 'warehouse_stock';
            const idColumn = item.is_gift ? 'gift_id' : 'product_id';
            const stock = (await tx.$queryRawUnsafe<any[]>(`SELECT stock FROM ${stockTable} WHERE ${idColumn}=? AND warehouse_id=? FOR UPDATE`, referenceId, warehouseId))[0]?.stock ?? 0;
            if (Number(stock) < item.qty) throw new Error(`Stok ${item.is_gift ? 'hadiah' : 'produk'} ${found.name} tidak mencukupi (tersedia ${stock})`);
            await tx.$executeRawUnsafe(`UPDATE ${stockTable} SET stock=stock-? WHERE ${idColumn}=? AND warehouse_id=?`, item.qty, referenceId, warehouseId);
          }
        }
      }

      if (userId) {
        await tx.activity_logs.create({
          data: {
            user_id: userId,
            action: 'Edit Pesanan',
            target: 'Pesanan',
            details: nextOrderCode !== (old.order_code || resolved.order_code)
              ? `Mengedit pesanan (Order: ${old.order_code || resolved.order_code} -> ${nextOrderCode}, Source: ${source})`
              : `Mengedit pesanan (Order: ${nextOrderCode}, Source: ${source})`,
            ip_address: ipAddress,
          },
        });
      }
    }, { timeout: 30000 });

    return NextResponse.json({ status: 'success', message: 'Semua perubahan pesanan berhasil disimpan' });
  } catch (error: any) {
    console.error('PUT olahan edit:', error);
    return NextResponse.json({ status: 'error', message: error.message || 'Gagal menyimpan perubahan' }, { status: 500 });
  }
}






