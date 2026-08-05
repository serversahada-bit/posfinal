import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { type RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from '@/lib/mysql';

export const dynamic = 'force-dynamic';

type ExportOrderRow = RowDataPacket & {
  id: number;
  order_code: string;
  customer_id: number | null;
  created_at: string;
  updated_at: string | null;
  processing_at: string | null;
  total_product_price: number | null;
  shipping_cost: number | null;
  total_payment: number | null;
  product_discount: number | null;
  other_fee: number | null;
  additional_shipping_cost: number | null;
  order_status: string;
  notes: string | null;
  promo_id: string | null;
  warehouse_id: number | null;
  advertiser_name: string | null;
  ad_source: string | null;
  customer_name: string | null;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  subdistrict: string | null;
  age: number | null;
  complaint: string | null;
  province: string | null;
  city: string | null;
  payment_method: string | null;
  payment_status: string | null;
  id_reff: string | null;
  courier_name: string | null;
  courier_service: string | null;
  tracking_number: string | null;
  total_weight_gram: number | null;
  warehouse_name: string | null;
  warehouse_code: string | null;
  is_ro: number | null;
  ro_count: number | null;
  source_table: string;
  creator_name: string | null;
  source_label: string;
};

type ExportItemRow = RowDataPacket & {
  product_name: string;
  qty: number | null;
  price: number | null;
  discount: number | null;
  is_gift: number | null;
  is_bundle: number | null;
  product_code: string | null;
};

type PromoRow = RowDataPacket & {
  promo_name: string;
};

const toSafeNumber = (value: unknown): number => Number(value || 0);
const toSafeString = (value: unknown): string => (value == null ? '' : String(value));
const toExcelValue = (value: unknown): string | number | Date => {
  if (value instanceof Date) return value;
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value == null) return '';
  return String(value);
};

const EXCEL_TIME_ZONE = 'Asia/Jakarta';

const toDateObject = (value: unknown): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateParts = (value: unknown): Record<'day' | 'month' | 'year' | 'hour' | 'minute', string> | null => {
  const date = toDateObject(value);
  if (!date) return null;

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: EXCEL_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));

  return {
    day: map.day || '00',
    month: map.month || '00',
    year: map.year || '0000',
    hour: map.hour || '00',
    minute: map.minute || '00',
  };
};

const formatExcelDateTime = (value: unknown): string => {
  const parts = formatDateParts(value);
  if (!parts) return '';
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
};

const statusAllowsResendOnly = (status?: string) => status === 'rts';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { startDate, endDate, status, creatorName, selectedIds } = body;

    let conditionQuery = '';
    const params: Array<string | number> = [];

    if (selectedIds && selectedIds.trim() !== '') {
      const tokens = selectedIds.split(',').map((t: string) => t.trim()).filter(Boolean);
      const idConditions: string[] = [];

      for (const token of tokens) {
        const [sourceTable, orderIdStr] = token.split(':').map((s: string) => s.trim());
        const orderId = Number(orderIdStr);
        if (sourceTable?.toUpperCase() === 'CSO' && orderId > 0) {
          idConditions.push('id = ?');
          params.push(orderId);
        }
      }

      conditionQuery += idConditions.length > 0 ? ` AND (${idConditions.join(' OR ')})` : ' AND 1=0';
    } else {
      if (startDate) {
        conditionQuery += ' AND DATE(created_at) >= ?';
        params.push(startDate);
      }
      if (endDate) {
        conditionQuery += ' AND DATE(created_at) <= ?';
        params.push(endDate);
      }
      if (status) {
        if (statusAllowsResendOnly(status)) {
          conditionQuery += " AND (order_status = 'rts' OR source_label = 'RESEND')";
        } else {
          conditionQuery += ' AND order_status = ? AND source_label != ?';
          params.push(status, 'RESEND');
        }
      } else {
        conditionQuery += ' AND source_label != ?';
        params.push('RESEND');
      }
      if (creatorName) {
        conditionQuery += ' AND creator_name = ?';
        params.push(creatorName);
      }
    }

    const rawQuery = `
      SELECT * FROM (
        SELECT
          o.id,
          o.unique_code AS order_code,
          o.customer_id,
          COALESCE(o.pending_at, o.created_at) AS created_at,
          o.updated_at,
          CASE
            WHEN o.processing_at IS NOT NULL THEN o.processing_at
            WHEN o.status_pesanan IN ('processing', 'ready_to_ship', 'shipped', 'completed', 'rts', 'problem')
              THEN COALESCE(o.updated_at, o.created_at)
            ELSE NULL
          END AS processing_at,
          o.harga_barang AS total_product_price,
          o.ongkos_kirim AS shipping_cost,
          o.total_pembayaran AS total_payment,
          o.diskon_ekstra AS product_discount,
          o.biaya_lainnya AS other_fee,
          o.additional_shipping_cost,
          o.status_pesanan AS order_status,
          o.keterangan AS notes,
          o.promo AS promo_id,
          o.warehouse_id,
          o.advertiser_name,
          o.sumber_iklan AS ad_source,
          COALESCE(c.name, o.first_name) AS customer_name,
          COALESCE(c.whatsapp_number, o.contact) AS whatsapp_number,
          o.email,
          COALESCE(c.address, o.alamat) AS address,
          COALESCE(c.subdistrict, CONCAT_WS(', ', o.provinsi, o.kota_kabupaten, o.kecamatan)) AS subdistrict,
          COALESCE(c.age, o.usia_customer) AS age,
          COALESCE(c.complaint, o.keluhan_customer) AS complaint,
          COALESCE(c.province, o.provinsi) AS province,
          COALESCE(c.city, o.kota_kabupaten) AS city,
          p.payment_method,
          p.payment_status,
          p.fat_proof_url AS id_reff,
          s.courier_name,
          s.courier_service,
          s.tracking_number,
          s.total_weight_gram,
          w.warehouse_name,
          w.code AS warehouse_code,
          COALESCE(o.is_ro, 0) AS is_ro,
          COALESCE(o.ro_count, 0) AS ro_count,
          'CSO' AS source_table,
          CASE
            WHEN cu.role = 'admin' THEN NULL
            ELSE COALESCE(NULLIF(cu.name, ''), NULLIF(cu.email, ''))
          END AS creator_name,
          CASE
            WHEN o.order_source = 'RESEND' OR o.keterangan LIKE '[RESEND]%' THEN 'RESEND'
            WHEN o.order_source = 'CRM' THEN 'CRM'
            WHEN o.order_source = 'CSO_AUTO' THEN 'CSO'
            ELSE 'CSO AKUISISI'
          END AS source_label
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN payments p ON o.id = p.order_id
        LEFT JOIN shipments s ON o.id = s.order_id
        LEFT JOIN warehouses w ON COALESCE(s.warehouse_id, o.warehouse_id) = w.id
        LEFT JOIN users cu ON cu.id = o.created_by
        WHERE (p.payment_method IS NULL OR p.payment_method != 'bank_transfer' OR p.payment_status IN ('paid', 'rejected'))
      ) AS combined_orders
      WHERE 1=1 ${conditionQuery}
      ORDER BY created_at DESC
    `;

    const pool = getMysqlPool();
    const [orders] = await pool.query<ExportOrderRow[]>(rawQuery, params);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '';
    const worksheet = workbook.addWorksheet('Sheet1');

    const headers = [
      'Tanggal Proses', 'No Resi', 'Timestamp', 'Unique Code', 'Data Lengkap Pesanan Pembeli',
      'FIRST NAME', 'CONTACT*', 'Alamat', 'kota/kabupaten', 'kecamatan', 'Provinsi', 'BERAT',
      'JUMLAH BARANG', 'Harga Barang', 'HADIAH / BONUS', 'ISI PAKET', 'COD VALUE', 'Keterangan',
      'Ekspedisi', 'Tipe Pembayaran', 'Bukti Transfer Paket Non COD', 'Usia Customer',
      'Keluhan / Penyakit Customer', 'Keterangan Ninja',
      'product_name_1st', 'product_qty_1st', 'product_price_1st',
      'product_name_2nd', 'product_qty_2nd', 'product_price_2nd',
      'product_name_3rd', 'product_qty_3rd', 'product_price_3rd',
      'product_name_4rd', 'product_qty_4rd', 'product_price_4rd',
      'product_name_5rd', 'product_qty_5rd', 'product_price_5rd',
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', family: 2, size: 10, bold: true };
    });

    const promoCache: Record<string, string> = {};

    for (const order of orders) {
      const [items] = await pool.query<ExportItemRow[]>(
        `
          SELECT oi.product_name, oi.qty, oi.price, oi.discount, oi.is_gift, oi.is_bundle, p.product_code
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id AND COALESCE(oi.is_gift, 0) = 0
          WHERE oi.order_id = ?
        `,
        [order.id],
      );

      const productItems: ExportItemRow[] = [];
      const giftItems: ExportItemRow[] = [];
      let totalQty = 0;

      for (const item of items) {
        if (Number(item.is_gift || 0) === 1) {
          giftItems.push(item);
        } else {
          productItems.push(item);
          totalQty += Number(item.qty || 0);
        }
      }

      const paketParts = productItems.map((pi) => `${pi.qty}_${pi.product_code || pi.product_name}`);
      let productString = paketParts.join('_');

      if (order.source_label === 'CRM' && productString) {
        productString = `R-${productString}`;
      } else if ((order.source_label === 'CSO' || order.source_label === 'CSO AKUISISI') && productString) {
        productString = `S-${productString}`;
      }

      const hadiahParts = giftItems.map((gi) => `${gi.qty}_${gi.product_name}`);
      const hadiahStr = hadiahParts.length > 0 ? `${hadiahParts.join('; ')};` : '';

      let isiPaketStr = productString;
      if (hadiahStr) {
        isiPaketStr += ` dan ${hadiahStr}`;
      }
      isiPaketStr += ' | Kurir Hubungi Dulu Sebelum Antar Lewat Whatsapp | Ketuk Pintu/Gerbang';

      let notesStr = (order.notes || '').trim();
      if (notesStr) {
        notesStr = notesStr.replace(/[\r\n]+/g, ' ');
        isiPaketStr += ` | ${notesStr}`;
      }

      const subdistrictStr = (order.subdistrict || '').trim();
      const parts = subdistrictStr.split(',').map((p) => p.trim()).filter(Boolean);
      let kecamatan = '';
      let kotaKab = '';
      let provinsi = '';

      if (parts.length >= 3) {
        const firstPart = parts[0].toUpperCase();
        const provinceHints = ['ACEH', 'SUMATERA', 'RIAU', 'JAMBI', 'BENGKULU', 'LAMPUNG', 'BANTEN', 'JAKARTA', 'DKI', 'JAWA', 'YOGYAKARTA', 'DIY', 'BALI', 'NTB', 'NUSA', 'KALIMANTAN', 'SULAWESI', 'GORONTALO', 'MALUKU', 'PAPUA'];
        const looksLikeProvinceFirst = provinceHints.some((hint) => firstPart.includes(hint));

        if (looksLikeProvinceFirst) {
          provinsi = parts[0] || '';
          kotaKab = parts[1] || '';
          kecamatan = parts[2] || '';
        } else {
          kecamatan = parts[0] || '';
          kotaKab = parts[1] || '';
          provinsi = parts[2] || '';
        }
      } else {
        kecamatan = parts[0] || '';
        kotaKab = parts[1] || (order.city || '');
        provinsi = order.province || '';
      }

      let ekspedisi = order.courier_name || '';
      if (ekspedisi && order.courier_service) {
        ekspedisi += ` ${order.courier_service}`;
      }

      let berat = 1;
      const weightGram = Number(order.total_weight_gram || 0);
      if (weightGram > 0) {
        berat = Math.ceil(weightGram / 1000);
      }

      let codValue: string | number = '';
      if (order.payment_method === 'cod' || order.payment_method === 'no_payment') {
        codValue = toSafeNumber(order.total_payment);
      }

      const processedAt = order.processing_at || order.created_at || null;
      const orderMasukAt = order.created_at || null;
      const tanggalProses = formatExcelDateTime(processedAt);
      const timestamp = formatExcelDateTime(orderMasukAt);
      const noResiStr = order.tracking_number ? toSafeString(order.tracking_number) : '';

      const usia = order.age != null ? order.age : '-';
      const keluhan = order.complaint || '-';

      let addressUpper = (order.address || '').toUpperCase();
      addressUpper = addressUpper.replace(/[:.]/g, '');

      let promoName = '-';
      if (order.promo_id) {
        const promoIds = order.promo_id.split(',').map((pid) => pid.trim()).filter(Boolean);
        const promoNames: string[] = [];
        for (const pid of promoIds) {
          if (!promoCache[pid]) {
            const [promoRows] = await pool.query<PromoRow[]>('SELECT promo_name FROM promos WHERE id = ? LIMIT 1', [Number(pid)]);
            promoCache[pid] = promoRows[0]?.promo_name || '-';
          }
          promoNames.push(promoCache[pid]);
        }
        if (promoNames.length > 0) {
          promoName = promoNames.join(', ');
        }
      }

      const csCrm = order.source_label;
      let adv = order.advertiser_name || '';
      if (csCrm === 'CRM') adv = '';

      const legacyOtherFee = Number(order.other_fee || 0);
      const fee = Number(order.additional_shipping_cost || 0) > 0
        ? Number(order.additional_shipping_cost || 0)
        : (order.payment_method === 'cod' && legacyOtherFee > 0 ? legacyOtherFee : 0);
      const ro = Number(order.is_ro || 0) === 1 ? (order.ro_count || '') : '';

      let keteranganNinja = '';
      if (order.order_code && order.created_at) {
        const dObj = new Date(order.created_at);
        const y = String(dObj.getFullYear()).slice(-2);
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const day = String(dObj.getDate()).padStart(2, '0');
        const h = String(dObj.getHours()).padStart(2, '0');
        const i = String(dObj.getMinutes()).padStart(2, '0');
        const s = String(dObj.getSeconds()).padStart(2, '0');
        keteranganNinja = `${order.order_code}#${y}${m}${day}/${h}${i}${s}`;
      }

      const payLabel = order.payment_method === 'cod' ? 'COD' : (order.payment_method === 'bank_transfer' ? 'transfer' : order.payment_method);
      const creatorNameValue = order.creator_name || 'User';
      const sessionUserName = creatorNameValue.replace(/ /g, '.');
      let advName = adv.replace(/\s*-\s*(?=\()/g, '').replace(/\s+/g, '.');
      let advSource = order.ad_source || '';

      if (csCrm === 'CRM') {
        advName = 'CRM';
        if (notesStr.toLowerCase().includes('meta ads')) {
          advSource = 'Meta Ads';
        } else {
          advSource = '';
        }
      }

      let csAdvStr = `${sessionUserName}.${advName}`.replace(/^\.+|\.+$/g, '');
      if (!csAdvStr) csAdvStr = '-';

      const ongkirVal = Number(order.shipping_cost || 0);
      const diskonVal = Number(order.product_discount || 0);
      const roVal = ro ? `RO${ro}` : '-';
      const promoVal = promoName !== '-' ? promoName : '-';
      const advSourcePart = advSource ? `:${advSource}` : ':-';
      const warehouseCode = (order.warehouse_code || 'J').toString().trim() || 'J';
      const keteranganStr = `${warehouseCode}.${csAdvStr}${advSourcePart}.${ongkirVal}.${fee}.${diskonVal}.${roVal}.${promoVal}`;

      let isiPaketShort = productString;
      if (giftItems.length > 0) {
        const hShort = giftItems.map((gi) => `${gi.qty}_${gi.product_name}`);
        isiPaketShort += ` #${hShort.join('; ')}; #`;
      } else {
        isiPaketShort += ' ##';
      }

      const dataLengkap = `"${order.customer_name || ''}" "${order.whatsapp_number || ''}" "${order.address || ''}" "${isiPaketShort}" ${payLabel} : ${ekspedisi} "${order.total_product_price || 0}" "${keteranganStr}" `;

      if (keteranganNinja) {
        keteranganNinja += `$${keteranganStr}`;
      }

      let buktiTransfer = order.id_reff ? toSafeString(order.id_reff) : '';
      if (!buktiTransfer && order.payment_status === 'rejected') {
        buktiTransfer = 'rejected';
      } else if (!buktiTransfer && ['processing', 'ready_to_ship', 'shipped'].includes(order.order_status)) {
        buktiTransfer = 'Process';
      }

      let customerNameMod = order.customer_name || '';
      if (notesStr.includes('[RESEND]')) {
        const match = notesStr.match(/\[OLD:(.*?)\]/);
        if (match && match[1]) {
          customerNameMod += ` - ${match[1].trim()}`;
        }
      }

      const rowData: unknown[] = [
        tanggalProses,
        noResiStr,
        timestamp,
        order.order_code,
        dataLengkap,
        customerNameMod,
        order.whatsapp_number ? String(order.whatsapp_number) : '',
        addressUpper,
        kotaKab,
        kecamatan,
        provinsi,
        berat,
        totalQty,
        Number(order.total_product_price || 0),
        hadiahStr,
        isiPaketStr,
        codValue,
        keteranganStr,
        ekspedisi,
        order.payment_method || '',
        buktiTransfer,
        usia,
        keluhan,
        keteranganNinja,
      ];

      const exportItems = [...productItems, ...giftItems];
      for (let i = 0; i < 5; i += 1) {
        if (exportItems[i]) {
          rowData.push(
            (exportItems[i].product_name || '').toUpperCase(),
            toSafeNumber(exportItems[i].qty),
            (toSafeNumber(exportItems[i].price) - toSafeNumber(exportItems[i].discount || 0)) * toSafeNumber(exportItems[i].qty),
          );
        } else {
          rowData.push('', '', '');
        }
      }

      const outputRow = worksheet.addRow(rowData.map(toExcelValue));
      outputRow.getCell(2).value = noResiStr;
      outputRow.getCell(7).value = order.whatsapp_number ? toSafeString(order.whatsapp_number) : '';
    }

    const referenceWidths = [
      15, 15, 20, 14, 60, 11, 14, 60, 20, 10, 11, 6, 14,
      13, 18, 60, 10, 28, 10, 16, 29, 14, 28, 56, 17, 16,
      18, 17, 16, 18, 17, 16, 18, 17, 16, 18, 17, 16, 18,
    ];
    referenceWidths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });

    const buffer = await workbook.xlsx.writeBuffer();

    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const timestampName = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Data_Pesanan_Olahan_${timestampName}.xlsx"`,
      },
    });
  } catch (error: unknown) {
    console.error('Error generating export:', error);
    return NextResponse.json({ status: 'error', message: error instanceof Error ? error.message : 'Gagal export data olahan' }, { status: 500 });
  }
}
