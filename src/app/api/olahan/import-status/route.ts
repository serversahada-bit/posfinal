import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { Buffer } from 'node:buffer';

import prisma from '@/lib/db';
import { emitEvent } from '@/lib/socket-server';
import { syncOrderTimestampColumns } from '@/lib/orderTimestamps';
import { logOrderStatusChange } from '@/lib/orderStatusLog';

export const dynamic = 'force-dynamic';

const statusAliasMap: Record<string, string> = {
  pending: 'pending',
  processing: 'processing',
  'ready_to_ship': 'ready_to_ship',
  'ready to ship': 'ready_to_ship',
  readytoship: 'ready_to_ship',
  'redy to ship': 'ready_to_ship',
  shipped: 'shipped',
  completed: 'completed',
  rts: 'rts',
  problem: 'problem',
  cancelled: 'cancelled',
  cancel: 'cancelled',
  paid: 'paid',
};

function normalizeStatus(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return statusAliasMap[normalized] || statusAliasMap[normalized.replace(/ /g, '_')] || '';
}

async function findOrderByCode(orderCode: string) {
  const order = await prisma.$queryRawUnsafe<Array<{ id: number; order_code: string; order_status: string; source_label: string }>>(
    `
      SELECT
        id,
        unique_code AS order_code,
        status_pesanan AS order_status,
        CASE
          WHEN order_source = 'RESEND' OR keterangan LIKE '[RESEND]%' THEN 'RESEND'
          WHEN order_source = 'CRM' THEN 'CRM'
          WHEN order_source = 'CSO_AUTO' THEN 'CSO'
          ELSE 'CSO AKUISISI'
        END AS source_label
      FROM orders
      WHERE unique_code = ?
      LIMIT 1
    `,
    orderCode,
  );

  return order[0] || null;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const userId = Number(formData.get('user_id') || 0);

    if (!(file instanceof File)) {
      return NextResponse.json({ status: 'error', message: 'File wajib diunggah.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ status: 'error', message: 'Format file tidak valid. Harap gunakan format .xlsx' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    const fileBuffer = Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(fileBuffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      return NextResponse.json({ status: 'error', message: 'Worksheet tidak ditemukan dalam file.' }, { status: 400 });
    }

    let successCount = 0;

    await prisma.$transaction(async (tx) => {
      for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
        const row = worksheet.getRow(rowIndex);
        const kodePesanan = String(row.getCell(1).text || '').trim();
        let statusBaruRaw = String(row.getCell(2).text || '').trim();
        const noResi = String(row.getCell(4).text || '').trim();

        if (!kodePesanan) {
          continue;
        }

        if (!statusBaruRaw && noResi) {
          statusBaruRaw = 'shipped';
        }

        const statusBaru = normalizeStatus(statusBaruRaw);
        if (!statusBaru && !noResi) {
          continue;
        }

        const order = await findOrderByCode(kodePesanan);
        if (!order) {
          continue;
        }

        if (statusBaru) {
          const eventAt = new Date();
          await tx.$executeRawUnsafe(
            'UPDATE orders SET status_pesanan = ?, updated_at = ? WHERE id = ?',
            statusBaru,
            eventAt,
            order.id,
          );
          await syncOrderTimestampColumns(tx, 'orders', order.id, statusBaru, eventAt);
          if (order.order_status !== statusBaru) {
            await logOrderStatusChange(tx, { userId, orderCode: order.order_code, source: order.source_label, fromStatus: order.order_status, toStatus: statusBaru, reason: 'Import status' });
          }
        }

        if (noResi) {
          const shipment = await tx.shipments.findFirst({ where: { order_id: order.id }, select: { id: true, shipment_status: true } });
          if (shipment) {
            await tx.shipments.update({
              where: { id: shipment.id },
              data: {
                tracking_number: noResi,
                shipment_status: shipment.shipment_status === 'pending' && statusBaru === 'shipped' ? 'shipped' : shipment.shipment_status,
              },
            });
          } else {
            await tx.shipments.create({
              data: {
                order_id: order.id,
                tracking_number: noResi,
                shipment_status: statusBaru === 'shipped' ? 'shipped' : 'pending',
              },
            });
          }
        }

        successCount += 1;
      }

      if (successCount > 0 && userId > 0) {
        await tx.activity_logs.create({
          data: {
            user_id: userId,
            action: 'Import Status',
            target: 'Pesanan',
            details: `Import update status sebanyak ${successCount} pesanan`,
          },
        });
      }
    });

    await emitEvent('REFRESH_OLAHAN');

    return NextResponse.json({
      status: 'success',
      message: `Berhasil memperbarui ${successCount} data pesanan.`,
    });
  } catch (error: unknown) {
    console.error('[API /olahan/import-status POST]', error);
    return NextResponse.json({ status: 'error', message: error instanceof Error ? error.message : 'Gagal memproses file status' }, { status: 500 });
  }
}
