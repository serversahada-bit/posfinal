import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { type RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from '@/lib/mysql';

export const dynamic = 'force-dynamic';

type TemplateRow = RowDataPacket & {
  order_id: number;
  order_code: string;
  order_status: string;
  created_at: Date;
  creator_name: string | null;
  source_table: string;
  source_label: string;
};

const buildCondition = (payload: { startDate?: string; endDate?: string; status?: string; creatorName?: string; selectedIds?: string }) => {
  const { startDate, endDate, status, creatorName, selectedIds } = payload;
  let conditionQuery = '';
  const params: Array<string | number> = [];

  if (selectedIds && selectedIds.trim() !== '') {
    const tokens = selectedIds.split(',').map((item) => item.trim()).filter(Boolean);
    const pairConditions: string[] = [];

    for (const token of tokens) {
      if (!token.includes(':')) {
        continue;
      }

      const [sourceTable, orderIdStr] = token.split(':').map((item) => item.trim());
      const source = sourceTable.toUpperCase();
      const orderId = Number(orderIdStr);

      if (source === 'CSO' && orderId > 0) {
        pairConditions.push('(source_table = ? AND order_id = ?)');
        params.push(source, orderId);
      }
    }

    conditionQuery += pairConditions.length > 0 ? ` AND (${pairConditions.join(' OR ')})` : ' AND 1=0';
    return { conditionQuery, params };
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

  return { conditionQuery, params };
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as { startDate?: string; endDate?: string; status?: string; creatorName?: string; selectedIds?: string };
    const { conditionQuery, params } = buildCondition(body);

    const query = `
      SELECT * FROM (
        SELECT
          o.id AS order_id,
          o.unique_code AS order_code,
          o.status_pesanan AS order_status,
          COALESCE(o.pending_at, o.created_at) AS created_at,
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
        LEFT JOIN payments p ON o.id = p.order_id
        LEFT JOIN users cu ON cu.id = o.created_by
        WHERE (p.payment_method IS NULL OR p.payment_method != 'bank_transfer' OR p.payment_status IN ('paid', 'rejected'))
      ) AS combined_orders
      WHERE 1=1 ${conditionQuery}
      ORDER BY created_at DESC
    `;

    const pool = getMysqlPool();
    const [orders] = await pool.query<TemplateRow[]>(query, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template Status');

    worksheet.columns = [
      { header: 'order_id', key: 'order_id', width: 25 },
      { header: 'status', key: 'status', width: 20 },
      { header: 'timestamp', key: 'timestamp', width: 25 },
      { header: 'shipment_receipt', key: 'shipment_receipt', width: 35 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6366F1' },
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 12,
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF4F46E5' } },
        bottom: { style: 'thin', color: { argb: 'FF4F46E5' } },
        left: { style: 'thin', color: { argb: 'FF4F46E5' } },
        right: { style: 'thin', color: { argb: 'FF4F46E5' } },
      };
    });

    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    orders.forEach((order, index) => {
      const row = worksheet.addRow({
        order_id: order.order_code,
        status: order.order_status,
        timestamp: order.created_at,
        shipment_receipt: '',
      });

      const isEven = index % 2 === 0;

      row.eachCell((cell, colNumber) => {
        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' },
          };
        }

        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 3 ? 'center' : 'left',
          indent: colNumber === 3 ? 0 : 1,
        };

        if (colNumber === 3) {
          cell.numFmt = 'dd/mm/yyyy hh:mm:ss';
        }

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Template_Update_Status.xlsx"',
      },
    });
  } catch (error: unknown) {
    console.error('[API /olahan/template POST]', error);
    return NextResponse.json({ status: 'error', message: error instanceof Error ? error.message : 'Gagal membuat template status' }, { status: 500 });
  }
}
