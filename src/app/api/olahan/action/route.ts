import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db';
import { emitEvent } from '@/lib/socket-server';
import { syncOrderTimestampColumns } from '@/lib/orderTimestamps';
import { logOrderStatusChange } from '@/lib/orderStatusLog';

export const dynamic = 'force-dynamic';

function buildStatusUpdateQuery(tableName: string, statusColumn: string, ids: number[]) {
  const placeholders = ids.map(() => '?').join(', ');
  return `UPDATE ${tableName} SET ${statusColumn} = ?, updated_at = ? WHERE id IN (${placeholders})`;
}

function buildStatusUpdateParams(status: string, ids: number[], eventAt: Date) {
  return [status, eventAt, ...ids];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, csoIds, csoAutoIds, crmIds, bulk_status, userId } = body;

    let count = 0;

    const csoIdArray = csoIds ? csoIds.split(',').map(Number).filter(Boolean) : [];
    const csoAutoIdArray = csoAutoIds ? csoAutoIds.split(',').map(Number).filter(Boolean) : [];
    const crmIdArray = crmIds ? crmIds.split(',').map(Number).filter(Boolean) : [];

    if (action === 'bulk_update_status') {
      const validStatuses = ['pending', 'processing', 'ready_to_ship', 'shipped', 'completed', 'rts', 'problem', 'cancelled'];
      if (!validStatuses.includes(bulk_status)) {
        return NextResponse.json({ status: 'error', message: 'Status tidak valid.' }, { status: 400 });
      }

      const eventAt = new Date();

      await prisma.$transaction(async (tx) => {
        const csoRows = csoIdArray.length > 0
          ? await tx.$queryRawUnsafe<Array<{ id: number; order_code: string; order_status: string }>>(
              `SELECT id, unique_code AS order_code, status_pesanan AS order_status FROM orders WHERE id IN (${csoIdArray.map(() => '?').join(', ')})`,
              ...csoIdArray,
            )
          : [];
        const csoAutoRows = csoAutoIdArray.length > 0
          ? await tx.$queryRawUnsafe<Array<{ id: number; order_code: string; order_status: string }>>(
              `SELECT id, unique_code AS order_code, status_pesanan AS order_status FROM orders WHERE id IN (${csoAutoIdArray.map(() => '?').join(', ')})`,
              ...csoAutoIdArray,
            )
          : [];
        const crmRows = crmIdArray.length > 0
          ? await tx.$queryRawUnsafe<Array<{ id: number; order_code: string; order_status: string }>>(
              `SELECT id, unique_code AS order_code, status_pesanan AS order_status FROM orders WHERE id IN (${crmIdArray.map(() => '?').join(', ')})`,
              ...crmIdArray,
            )
          : [];

        if (csoIdArray.length > 0) {
          await tx.$executeRawUnsafe(
            buildStatusUpdateQuery('orders', 'status_pesanan', csoIdArray),
            ...buildStatusUpdateParams(bulk_status, csoIdArray, eventAt),
          );
          for (const id of csoIdArray) {
            await syncOrderTimestampColumns(tx, 'orders', id, bulk_status, eventAt);
            const row = csoRows.find((item) => Number(item.id) === id);
            if (row && row.order_status !== bulk_status) {
              await logOrderStatusChange(tx, { userId, orderCode: row.order_code, source: 'CSO AKUISISI', fromStatus: row.order_status, toStatus: bulk_status, reason: 'Bulk update status' });
            }
          }
          count += csoIdArray.length;
        }

        if (csoAutoIdArray.length > 0) {
          await tx.$executeRawUnsafe(
            buildStatusUpdateQuery('orders', 'status_pesanan', csoAutoIdArray),
            ...buildStatusUpdateParams(bulk_status, csoAutoIdArray, eventAt),
          );
          for (const id of csoAutoIdArray) {
            await syncOrderTimestampColumns(tx, 'orders', id, bulk_status, eventAt);
            const row = csoAutoRows.find((item) => Number(item.id) === id);
            if (row && row.order_status !== bulk_status) {
              await logOrderStatusChange(tx, { userId, orderCode: row.order_code, source: 'CSO', fromStatus: row.order_status, toStatus: bulk_status, reason: 'Bulk update status' });
            }
          }
          count += csoAutoIdArray.length;
        }

        if (crmIdArray.length > 0) {
          await tx.$executeRawUnsafe(
            buildStatusUpdateQuery('orders', 'status_pesanan', crmIdArray),
            ...buildStatusUpdateParams(bulk_status, crmIdArray, eventAt),
          );
          for (const id of crmIdArray) {
            await syncOrderTimestampColumns(tx, 'orders', id, bulk_status, eventAt);
            const row = crmRows.find((item) => Number(item.id) === id);
            if (row && row.order_status !== bulk_status) {
              await logOrderStatusChange(tx, { userId, orderCode: row.order_code, source: 'CRM', fromStatus: row.order_status, toStatus: bulk_status, reason: 'Bulk update status' });
            }
          }
          count += crmIdArray.length;
        }

        if (count > 0 && userId) {
          await tx.activity_logs.create({
            data: {
              user_id: userId,
              action: 'Bulk Update Status',
              target: 'Pesanan',
              details: `Mengubah ${count} pesanan menjadi status: ${bulk_status}`,
            },
          });
        }
      });

      await emitEvent('REFRESH_OLAHAN');

      return NextResponse.json({ status: 'success', message: `Berhasil update status ${count} pesanan.` });
    }

    if (action === 'bulk_delete') {
      const processDelete = async (tx: Prisma.TransactionClient, ids: number[]) => {
        if (ids.length === 0) return;

        for (const deleteId of ids) {
          const whResult: Array<{ warehouse_id: number | null }> = await tx.$queryRawUnsafe(
            'SELECT warehouse_id FROM orders WHERE id = ?',
            deleteId,
          );
          const whId = whResult[0]?.warehouse_id;

          if (whId) {
            const items: Array<{ product_id: number | null; qty: number | null; is_gift: number | null; is_bundle: number | null }> = await tx.$queryRawUnsafe(
              'SELECT product_id, qty, is_gift, is_bundle FROM order_items WHERE order_id = ?',
              deleteId,
            );

            for (const item of items) {
              const isGiftItem = Number(item.is_gift || 0) === 1;
              const qty = Number(item.qty) || 0;
              const pid = Number(item.product_id) || 0;

              if (isGiftItem) {
                await tx.$queryRawUnsafe('UPDATE warehouse_gift_stock SET stock = stock + ? WHERE gift_id = ? AND warehouse_id = ?', qty, pid, whId);
              } else if (pid > 0) {
                await tx.$queryRawUnsafe('UPDATE warehouse_stock SET stock = stock + ? WHERE product_id = ? AND warehouse_id = ?', qty, pid, whId);
              }
            }
          }

          await tx.$queryRawUnsafe('DELETE FROM orders WHERE id = ?', deleteId);
          count += 1;
        }
      };

      await prisma.$transaction(async (tx) => {
        await processDelete(tx, csoIdArray);
        await processDelete(tx, csoAutoIdArray);
        await processDelete(tx, crmIdArray);

        if (count > 0 && userId) {
          await tx.activity_logs.create({
            data: {
              user_id: userId,
              action: 'Bulk Delete',
              target: 'Pesanan',
              details: `Menghapus ${count} pesanan massal`,
            },
          });
        }
      });

      await emitEvent('REFRESH_OLAHAN');

      return NextResponse.json({ status: 'success', message: `Berhasil menghapus ${count} pesanan.` });
    }

    return NextResponse.json({ status: 'error', message: 'Action tidak dikenal.' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error action olahan:', error);
    return NextResponse.json({ status: 'error', message: error instanceof Error ? error.message : 'Gagal menjalankan aksi olahan' }, { status: 500 });
  }
}
