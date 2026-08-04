import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { emitEvent } from '@/lib/socket-server';
import { withMysqlTransaction } from '@/lib/mysql';
import {
  generateLegacyOrderCode,
  getTodayDateString,
  insertActivityLog,
  parseRegion,
  resolveOrderItem,
  upsertCustomer,
  upsertCustomerAddressSnapshot,
} from '@/lib/mysql-order-helpers';
import { saveUploadBuffer } from '@/lib/uploadStorage';

export const dynamic = 'force-dynamic';

type ExistingOrderRow = RowDataPacket & {
  id: number;
};

type NoPaymentMethodRow = RowDataPacket & {
  method_name: string;
};

type PaymentAccountRow = RowDataPacket & {
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
};

type CourierRow = RowDataPacket & {
  id: number;
};

type OrderItemInsert = {
  productId: number | null;
  productName: string;
  qty: number;
  price: number;
  discount: number;
  subtotal: number;
  isGift: boolean;
  isBundle: boolean;
  stockProductId: number | null;
  stockGiftId: number | null;
  stockQty: number;
  weightGram: number;
};

type ProductSummary = {
  name: string;
  qty: number;
  price: number;
};

function parseInteger(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableString(value: FormDataEntryValue | null) {
  const normalized = String(value || '').trim();
  return normalized || null;
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

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const formData = await request.formData();
    const createdByUserId = parseInteger(cookieStore.get('sahada_user_id')?.value || formData.get('user_id'), 0) || null;
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;

    const customerName = String(formData.get('customer_name') || '').trim();
    const whatsapp = String(formData.get('whatsapp_number') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const address = String(formData.get('address') || '').trim();
    const subdistrict = String(formData.get('subdistrict') || '').trim();
    const desa = String(formData.get('desa') || '').trim();
    const age = parseInteger(formData.get('age'), 0) || null;
    const complaint = String(formData.get('complaint') || '').trim();
    const customerId = parseInteger(formData.get('customer_id'), 0) || null;

    const totalProductPrice = parseInteger(formData.get('total_product_price'));
    const productDiscount = parseInteger(formData.get('product_discount'));
    const shippingCost = parseInteger(formData.get('shipping_cost'));
    const manualFeeCod = parseInteger(formData.get('manual_fee_cod'));
    const otherFee = parseInteger(formData.get('other_fee'));
    const totalPayment = parseInteger(formData.get('total_payment'));
    const warehouseId = parseInteger(formData.get('warehouse_id'), 0) || null;
    const courierName = String(formData.get('courier_name') || '').trim();
    const paymentMethod = String(formData.get('payment_method') || '').trim();
    const noPaymentMethodId = parseInteger(formData.get('no_payment_method_id'), 0) || 0;
    const rawNotes = String(formData.get('notes') || '').trim();
    const notes = `[RESEND] ${rawNotes}`.trim();
    const advertiserName = String(formData.get('advertiser_name') || '').trim();
    const adSource = String(formData.get('ad_source') || '').trim();
    const scalevOrderId = toNullableString(formData.get('order_code'));
    const promoId = String(formData.get('promo_id') || '').trim();
    const paymentAccountId = parseInteger(formData.get('payment_account_id'), 0) || 0;

    if (!customerName || !whatsapp || !address || !subdistrict) {
      return NextResponse.json({ status: 'error', message: 'Data pelanggan belum lengkap.' }, { status: 400 });
    }

    if (scalevOrderId && scalevOrderId.length !== 13) {
      return NextResponse.json({ status: 'error', message: 'Kode Scalev harus tepat 13 karakter' }, { status: 400 });
    }

    let paymentProofUrl: string | null = null;
    const file = formData.get('payment_proof') as File | null;
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = file.name.split('.').pop() || 'jpg';
      const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
      const stored = await saveUploadBuffer(['payments'], filename, buffer);
      paymentProofUrl = stored.url;
    }

    const pIds = formData.getAll('item_product_id[]') as string[];
    const isGifts = formData.getAll('item_is_gift[]') as string[];
    const isBundles = formData.getAll('item_is_bundle[]') as string[];
    const pPrices = formData.getAll('item_price[]') as string[];
    const pDiscs = formData.getAll('item_discount[]') as string[];
    const pQtys = formData.getAll('item_qty[]') as string[];

    if (pIds.length === 0) {
      return NextResponse.json({ status: 'error', message: 'Keranjang pesanan masih kosong.' }, { status: 400 });
    }

    const region = parseRegion(subdistrict);

    const orderResult = await withMysqlTransaction(async (connection) => {
      if (scalevOrderId) {
        const [existingScalev] = await connection.query<ExistingOrderRow[]>(
          'SELECT id FROM orders WHERE scalev_order_id = ? LIMIT 1',
          [scalevOrderId],
        );

        if (existingScalev.length > 0) {
          throw new Error('Kode Scalev sudah digunakan.');
        }
      }

      const customer = await upsertCustomer(connection, {
        customerId,
        customerName,
        whatsapp,
        email: email || null,
        address,
        subdistrict,
        desa: desa || null,
        age,
        complaint: complaint || null,
        region,
      });

      const addressSnapshot = await upsertCustomerAddressSnapshot(connection, {
        customerId: customer.id,
        receiverName: customerName,
        whatsappNumber: whatsapp,
        address,
        district: region.district === '-' ? null : region.district,
        city: region.city === '-' ? null : region.city,
        province: region.province === '-' ? null : region.province,
      });

      const [courierRows] = courierName
        ? await connection.query<CourierRow[]>('SELECT id FROM couriers WHERE courier_name = ? LIMIT 1', [courierName])
        : [[] as CourierRow[]];
      const courierId = courierRows[0]?.id || null;

      const uniqueCode = await generateLegacyOrderCode(connection, {
        tableName: 'orders',
        codeColumn: 'unique_code',
        prefixLetter: 'D',
        warehouseId,
        courierName,
        paymentMethod,
      });

      const eventAt = new Date();
      const orderItems: OrderItemInsert[] = [];
      const packageItems: ProductSummary[] = [];
      const giftItems: ProductSummary[] = [];
      let totalWeightGrams = 0;
      let totalQty = 0;

      for (let i = 0; i < pIds.length; i += 1) {
        const itemId = parseInteger(pIds[i], 0);
        const isGift = isGifts[i] === '1';
        const isBundle = isBundles[i] === '1';
        const price = parseInteger(pPrices[i], 0);
        const discount = parseInteger(pDiscs[i], 0);
        const qty = Math.max(1, parseInteger(pQtys[i], 1));
        const subtotal = Math.max(0, (price - discount) * qty);
        const resolvedItem = await resolveOrderItem(connection, { itemId, isGift, isBundle });

        totalQty += qty;

        if (resolvedItem.kind === 'gift') {
          totalWeightGrams += resolvedItem.weightGram * qty;
          giftItems.push({ name: resolvedItem.name, qty, price: 0 });
          orderItems.push({
            productId: null,
            productName: resolvedItem.name,
            qty,
            price,
            discount,
            subtotal,
            isGift: true,
            isBundle: false,
            stockProductId: null,
            stockGiftId: resolvedItem.id,
            stockQty: qty,
            weightGram: resolvedItem.weightGram,
          });
          continue;
        }

        if (resolvedItem.kind === 'bundle') {
          packageItems.push({ name: resolvedItem.name, qty, price });
          for (const component of resolvedItem.components) {
            const componentQty = component.qtyPerBundle * qty;
            totalWeightGrams += component.weightGram * componentQty;
            orderItems.push({
              productId: component.productId,
              productName: component.productName,
              qty: componentQty,
              price,
              discount,
              subtotal: Math.max(0, (price - discount) * componentQty),
              isGift: false,
              isBundle: true,
              stockProductId: component.productId,
              stockGiftId: null,
              stockQty: componentQty,
              weightGram: component.weightGram,
            });
          }
          continue;
        }

        totalWeightGrams += resolvedItem.weightGram * qty;
        packageItems.push({ name: resolvedItem.name, qty, price });
        orderItems.push({
          productId: resolvedItem.id,
          productName: resolvedItem.name,
          qty,
          price,
          discount,
          subtotal,
          isGift: false,
          isBundle: false,
          stockProductId: resolvedItem.id,
          stockGiftId: null,
          stockQty: qty,
          weightGram: resolvedItem.weightGram,
        });
      }

      const productSlots = Array.from({ length: 5 }, (_, index) => getProductSlot(packageItems, index));
      const beratKg = Number((totalWeightGrams / 1000).toFixed(2));
      const codValue = paymentMethod === 'cod' ? totalPayment : 0;
      const additionalShippingCost = manualFeeCod;
      const shippingDiscount = 0;
      const biayaLainnya = otherFee;
      const dataLengkapPesanan = JSON.stringify({
        source: 'buat_pesanan_resend',
        unique_code: uniqueCode,
        scalev_order_id: scalevOrderId,
        customer: {
          id: customer.id,
          customer_address_id: addressSnapshot.id,
          first_name: customerName,
          contact: whatsapp,
          email: email || null,
          address,
          desa: desa || null,
          kecamatan: region.district,
          kota_kabupaten: region.city,
          provinsi: region.province,
          usia_customer: age,
          keluhan_customer: complaint || null,
        },
        items: orderItems,
        financials: {
          harga_barang: totalProductPrice,
          diskon_ekstra: productDiscount,
          ongkos_kirim: shippingCost,
          additional_shipping_cost: additionalShippingCost,
          shipping_discount: shippingDiscount,
          biaya_lainnya: biayaLainnya,
          total_pembayaran: totalPayment,
          cod_value: codValue,
        },
        shipping: {
          ekspedisi: courierName || null,
          warehouse_id: warehouseId,
          courier_id: courierId,
          berat_gram: totalWeightGrams,
          berat_kg: beratKg,
        },
        payment: {
          tipe_pembayaran: paymentMethod,
          bukti_transfer: paymentProofUrl,
        },
        metadata: {
          order_type: 'normal',
          order_source: 'RESEND',
          advertiser_name: advertiserName || null,
          sumber_iklan: adSource || null,
          promo: promoId || null,
          is_ro: false,
          ro_count: 0,
          created_by: createdByUserId,
        },
      });

      const [insertOrderResult] = await connection.query<ResultSetHeader>(
        `
          INSERT INTO orders (
            tanggal_proses, no_resi, unique_code, data_lengkap_pesanan,
            first_name, contact, email,
            alamat, desa, kecamatan, kota_kabupaten, provinsi,
            berat, jumlah_barang, harga_barang,
            hadiah_bonus, isi_paket,
            cod_value, diskon_ekstra, ongkos_kirim, biaya_lainnya, total_pembayaran,
            keterangan, catatan_internal,
            ekspedisi, tipe_pembayaran, bukti_transfer,
            usia_customer, keluhan_customer, keterangan_ninja,
            product_name_1st, product_qty_1st, product_price_1st,
            product_name_2nd, product_qty_2nd, product_price_2nd,
            product_name_3rd, product_qty_3rd, product_price_3rd,
            product_name_4th, product_qty_4th, product_price_4th,
            product_name_5th, product_qty_5th, product_price_5th,
            advertiser_name, sumber_iklan, scalev_order_id, promo,
            status_pesanan, customer_id, customer_address_id, order_type, order_source,
            warehouse_id, courier_id, pending_at, processing_at, last_update,
            is_ro, ro_count, additional_shipping_cost, shipping_discount, created_by
          ) VALUES (
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?
          )
        `,
        [
          getTodayDateString(),
          null,
          uniqueCode,
          dataLengkapPesanan,
          customerName,
          whatsapp,
          email || null,
          address,
          desa || null,
          region.district,
          region.city,
          region.province,
          beratKg,
          totalQty,
          totalProductPrice,
          summarizeItems(giftItems),
          summarizeItems(packageItems),
          codValue,
          productDiscount,
          shippingCost,
          biayaLainnya,
          totalPayment,
          null,
          notes || null,
          courierName || null,
          paymentMethod || null,
          paymentProofUrl,
          age,
          complaint || null,
          null,
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
          advertiserName || null,
          adSource || null,
          scalevOrderId,
          promoId || null,
          'pending',
          customer.id,
          addressSnapshot.id,
          'normal',
          'RESEND',
          warehouseId,
          courierId,
          eventAt,
          null,
          eventAt,
          0,
          0,
          additionalShippingCost,
          shippingDiscount,
          createdByUserId,
        ],
      );

      const orderId = Number(insertOrderResult.insertId);

      for (const item of orderItems) {
        if (warehouseId && item.stockGiftId) {
          await connection.query(
            'UPDATE warehouse_gift_stock SET stock = stock - ? WHERE gift_id = ? AND warehouse_id = ?',
            [item.stockQty, item.stockGiftId, warehouseId],
          );
        }

        if (warehouseId && item.stockProductId) {
          await connection.query(
            'UPDATE warehouse_stock SET stock = stock - ? WHERE product_id = ? AND warehouse_id = ?',
            [item.stockQty, item.stockProductId, warehouseId],
          );
        }

        await connection.query(
          `
            INSERT INTO order_items (
              order_id, product_id, product_name, qty, price, discount, subtotal, is_gift, is_bundle
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            orderId,
            item.productId,
            item.productName,
            item.qty,
            item.price,
            item.discount,
            item.subtotal,
            item.isGift ? 1 : 0,
            item.isBundle ? 1 : 0,
          ],
        );
      }

      if (courierName) {
        await connection.query(
          `
            INSERT INTO shipments (
              order_id, warehouse_id, courier_name, courier_service, shipping_cost, total_weight_gram, shipment_status
            ) VALUES (?, ?, ?, 'Reguler', ?, ?, 'pending')
          `,
          [orderId, warehouseId, courierName, shippingCost, totalWeightGrams],
        );
      }

      let bankName: string | null = null;
      let accountName: string | null = null;
      let accountNo: string | null = null;

      if (paymentMethod === 'bank_transfer' && paymentAccountId) {
        const [accountRows] = await connection.query<PaymentAccountRow[]>(
          'SELECT bank_name, account_name, account_number FROM payment_accounts WHERE id = ? LIMIT 1',
          [paymentAccountId],
        );
        const account = accountRows[0];
        if (account) {
          bankName = account.bank_name;
          accountName = account.account_name;
          accountNo = account.account_number;
        }
      } else if (paymentMethod === 'free' && noPaymentMethodId) {
        const [methodRows] = await connection.query<NoPaymentMethodRow[]>(
          'SELECT method_name FROM no_payment_methods WHERE id = ? LIMIT 1',
          [noPaymentMethodId],
        );
        const method = methodRows[0];
        if (method) {
          bankName = method.method_name;
          accountName = 'No Payment';
          accountNo = '-';
        }
      }

      const paymentStatus =
        paymentMethod === 'cod'
          ? 'unpaid'
          : paymentMethod === 'bank_transfer'
            ? 'waiting_confirmation'
            : paymentProofUrl
              ? 'waiting_confirmation'
              : 'unpaid';

      await connection.query(
        `
          INSERT INTO payments (
            order_id, payment_method, bank_name, account_name, account_number, payment_proof_url, payment_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderId,
          paymentMethod === 'cod'
            ? 'cod'
            : paymentMethod === 'free'
              ? 'free'
              : paymentMethod === 'ewallet'
                ? 'ewallet'
                : 'bank_transfer',
          bankName,
          accountName,
          accountNo,
          paymentProofUrl,
          paymentStatus,
        ],
      );

      await insertActivityLog(connection, {
        userId: createdByUserId,
        action: 'Create Pesanan',
        target: 'Pesanan',
        details: `Order: ${uniqueCode} | Source: RESEND | Status Awal: pending | Pesanan dibuat`,
        ipAddress,
      });

      return { order_code: uniqueCode, id: orderId };
    });

    await emitEvent('NEW_ORDER');
    await emitEvent('REFRESH_OLAHAN');

    return NextResponse.json({
      status: 'success',
      message: 'Pesanan berhasil dibuat',
      order_code: orderResult.order_code,
      order_id: orderResult.id,
    });
  } catch (error: unknown) {
    console.error('Error creating RESEND order:', error);

    const message = error instanceof Error ? error.message : 'Internal server error';
    const statusCode =
      message === 'Kode Scalev sudah digunakan.' ||
      message === 'Kode Scalev harus tepat 13 karakter' ||
      message === 'Data pelanggan belum lengkap.' ||
      message === 'Keranjang pesanan masih kosong.'
        ? 400
        : 500;

    return NextResponse.json({ status: 'error', message }, { status: statusCode });
  }
}
