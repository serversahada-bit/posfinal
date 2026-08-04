import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from '@/lib/mysql';

export const dynamic = 'force-dynamic';

type OlahanRow = RowDataPacket & {
  order_id: number;
  order_code: string;
  order_status: string;
  created_at: string;
  processing_at: string | null;
  last_update: string;
  advertiser_name: string | null;
  ad_source: string | null;
  notes: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  customer_name: string;
  whatsapp_number: string;
  desa: string | null;
  product_names: string | null;
  courier_name: string | null;
  courier_service: string | null;
  resi: string | null;
  id_reff: string | null;
  payment_status: string | null;
  reject_reason: string | null;
  creator_name: string | null;
  source_table: string;
  source_label: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const status = searchParams.get('status') || '';
    const creatorName = searchParams.get('creator_name') || '';
    const warehouseId = searchParams.get('warehouse_id') || '';
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'created_at';

    const sortColumnMap: Record<string, string> = {
      created_at: 'created_at',
      processing_at: 'processing_at',
      last_update: 'last_update',
    };
    const orderByColumn = sortColumnMap[sort] ?? 'created_at';

    const params: Array<string | number> = [];
    let conditionQuery = '';

    if (search) {
      conditionQuery += ' AND (order_code LIKE ? OR customer_name LIKE ? OR whatsapp_number LIKE ?)';
      const wildcard = `%${search}%`;
      params.push(wildcard, wildcard, wildcard);
    }

    if (startDate) {
      conditionQuery += ' AND DATE(created_at) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      conditionQuery += ' AND DATE(created_at) <= ?';
      params.push(endDate);
    }

    if (status === 'rts') {
      conditionQuery += " AND (order_status = 'rts' OR source_label = 'RESEND')";
    } else if (status) {
      conditionQuery += ' AND order_status = ? AND source_label != ?';
      params.push(status, 'RESEND');
    } else {
      conditionQuery += ' AND source_label != ?';
      params.push('RESEND');
    }

    if (creatorName) {
      conditionQuery += ' AND creator_name = ?';
      params.push(creatorName);
    }

    if (warehouseId) {
      conditionQuery += ' AND warehouse_id = ?';
      params.push(Number(warehouseId));
    }

    if (sort === 'processing_at') {
      conditionQuery += ' AND processing_at IS NOT NULL';
    }

    const rawQuery = `
      SELECT * FROM (
        SELECT
          o.id AS order_id,
          o.unique_code AS order_code,
          o.status_pesanan AS order_status,
          COALESCE(o.pending_at, o.created_at) AS created_at,
          CASE
            WHEN o.processing_at IS NOT NULL THEN o.processing_at
            WHEN o.status_pesanan IN ('processing', 'ready_to_ship', 'shipped', 'completed', 'rts', 'problem')
              THEN COALESCE(o.updated_at, o.created_at)
            ELSE NULL
          END AS processing_at,
          COALESCE(o.last_update, o.updated_at, o.created_at) AS last_update,
          o.advertiser_name,
          o.sumber_iklan AS ad_source,
          o.keterangan AS notes,
          o.warehouse_id,
          w.warehouse_name,
          COALESCE(ca.receiver_name, c.name, o.first_name) AS customer_name,
          COALESCE(ca.whatsapp_number, c.whatsapp_number, o.contact) AS whatsapp_number,
          COALESCE(c.desa, o.desa) AS desa,
          oi.product_names,
          COALESCE(s.courier_name, o.ekspedisi) AS courier_name,
          s.courier_service,
          COALESCE(s.tracking_number, o.no_resi) AS resi,
          p.fat_proof_url AS id_reff,
          p.payment_status,
          p.reject_reason,
          CASE
            WHEN cu.role = 'admin' THEN NULL
            ELSE COALESCE(NULLIF(cu.name, ''), NULLIF(cu.email, ''))
          END AS creator_name,
          'CSO' AS source_table,
          CASE
            WHEN o.order_source = 'RESEND' OR o.keterangan LIKE '[RESEND]%' THEN 'RESEND'
            WHEN o.order_source = 'CRM' THEN 'CRM'
            WHEN o.order_source = 'CSO_AUTO' THEN 'CSO'
            ELSE 'CSO AKUISISI'
          END AS source_label
        FROM orders o
        LEFT JOIN warehouses w ON w.id = o.warehouse_id
        LEFT JOIN customers c ON c.id = o.customer_id
        LEFT JOIN customer_addresses ca ON ca.id = o.customer_address_id
        LEFT JOIN (
          SELECT order_id, GROUP_CONCAT(product_name SEPARATOR ', ') AS product_names
          FROM order_items
          GROUP BY order_id
        ) oi ON oi.order_id = o.id
        LEFT JOIN payments p ON p.order_id = o.id
        LEFT JOIN shipments s ON s.order_id = o.id
        LEFT JOIN users cu ON cu.id = o.created_by
        WHERE (p.payment_method IS NULL OR p.payment_method != 'bank_transfer' OR p.payment_status IN ('paid', 'rejected'))
      ) AS combined_orders
      WHERE 1 = 1 ${conditionQuery}
      ORDER BY ${orderByColumn} DESC, created_at DESC
    `;

    const pool = getMysqlPool();
    const [orders] = await pool.query<OlahanRow[]>(rawQuery, params);

    return NextResponse.json({ status: 'success', data: orders });
  } catch (error: unknown) {
    console.error('Error fetching olahan data:', error);
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Gagal mengambil data olahan' },
      { status: 500 },
    );
  }
}
