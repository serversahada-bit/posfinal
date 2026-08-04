import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { type RowDataPacket } from 'mysql2/promise';
import { emitEvent } from '@/lib/socket-server';
import { withMysqlTransaction, getMysqlPool } from '@/lib/mysql';
import { insertActivityLog } from '@/lib/mysql-order-helpers';

type UnvalidatedOrder = RowDataPacket & {
  order_id: number;
  order_code: string;
  created_at: Date | string;
  total_payment: number;
  customer_name: string | null;
  payment_id: number;
  payment_status: string;
  payment_proof_url: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  reject_reason: string | null;
  source_table: 'AKUISISI' | 'CSO_AUTO' | 'CRM' | 'RESEND';
};

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getMysqlPool();
    const [rows] = await pool.query<UnvalidatedOrder[]>(
      `
        SELECT *
        FROM (
          SELECT
            o.id AS order_id,
            o.unique_code AS order_code,
            o.created_at,
            o.total_pembayaran AS total_payment,
            o.first_name AS customer_name,
            p.id AS payment_id,
            p.payment_status,
            p.payment_proof_url,
            p.bank_name,
            p.account_name,
            p.account_number,
            p.reject_reason,
            'AKUISISI' AS source_table
          FROM orders o
          INNER JOIN payments p ON o.id = p.order_id
          WHERE p.payment_method = 'bank_transfer' AND p.payment_status <> 'paid'

          UNION ALL

          SELECT
            o.id AS order_id,
            o.order_code,
            o.created_at,
            o.total_payment,
            c.name AS customer_name,
            p.id AS payment_id,
            p.payment_status,
            p.payment_proof_url,
            p.bank_name,
            p.account_name,
            p.account_number,
            p.reject_reason,
            'CSO_AUTO' AS source_table
          FROM orders_cso o
          LEFT JOIN customers c ON o.customer_id = c.id
          INNER JOIN payments_cso p ON o.id = p.order_id
          WHERE p.payment_method = 'bank_transfer' AND p.payment_status <> 'paid'

          UNION ALL

          SELECT
            o.id AS order_id,
            o.order_code,
            o.created_at,
            o.total_payment,
            c.name AS customer_name,
            p.id AS payment_id,
            p.payment_status,
            p.payment_proof_url,
            p.bank_name,
            p.account_name,
            p.account_number,
            p.reject_reason,
            'CRM' AS source_table
          FROM orders_crm o
          LEFT JOIN customers c ON o.customer_id = c.id
          INNER JOIN payments_crm p ON o.id = p.order_id
          WHERE p.payment_method = 'bank_transfer' AND p.payment_status <> 'paid'

          UNION ALL

          SELECT
            o.id AS order_id,
            o.order_code,
            o.created_at,
            o.total_payment,
            c.name AS customer_name,
            p.id AS payment_id,
            p.payment_status,
            p.payment_proof_url,
            p.bank_name,
            p.account_name,
            p.account_number,
            p.reject_reason,
            'RESEND' AS source_table
          FROM orders_resend o
          LEFT JOIN customers c ON o.customer_id = c.id
          INNER JOIN payments_resend p ON o.id = p.order_id
          WHERE p.payment_method = 'bank_transfer' AND p.payment_status <> 'paid'
        ) combined_unvalidated
        ORDER BY created_at DESC
      `,
    );

    return NextResponse.json({ status: 'success', data: rows });
  } catch (error: unknown) {
    console.error('Error fetching unvalidated orders:', error);
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userId = Number(cookieStore.get('sahada_user_id')?.value || 1) || 1;
    const body = await request.json();
    const { action, payment_id, source_table, id_reff } = body as {
      action?: string;
      payment_id?: number | string;
      source_table?: 'AKUISISI' | 'CSO_AUTO' | 'CRM' | 'RESEND';
      id_reff?: string;
      reject_reason?: string;
    };

    if (!payment_id || !source_table || !action) {
      return NextResponse.json({ status: 'error', message: 'Missing required parameters' }, { status: 400 });
    }

    const pid = Number(payment_id);

    const tableMap = {
      AKUISISI: { payments: 'payments', orders: 'orders', statusColumn: 'status_pesanan' },
      CSO_AUTO: { payments: 'payments_cso', orders: 'orders_cso', statusColumn: 'order_status' },
      CRM: { payments: 'payments_crm', orders: 'orders_crm', statusColumn: 'order_status' },
      RESEND: { payments: 'payments_resend', orders: 'orders_resend', statusColumn: 'order_status' },
    } as const;

    const config = tableMap[source_table];
    if (!config) {
      return NextResponse.json({ status: 'error', message: 'Invalid source table' }, { status: 400 });
    }

    if (action === 'approve') {
      if (!id_reff) {
        return NextResponse.json({ status: 'error', message: 'ID Reff wajib diisi' }, { status: 400 });
      }

      await withMysqlTransaction(async (connection) => {
        await connection.query(
          `
            UPDATE ${config.payments}
            SET payment_status = 'paid', paid_at = NOW(), fat_proof_url = ?
            WHERE id = ?
          `,
          [id_reff, pid],
        );

        await insertActivityLog(connection, {
          userId,
          action: 'Approve FAT',
          target: 'Validasi Pembayaran',
          details: `Approve pembayaran ID: ${pid} (ID Reff: ${id_reff})`,
        });
      });

      await emitEvent('NEW_OLAHAN');
      return NextResponse.json({ status: 'success', message: 'Pembayaran berhasil divalidasi FAT.' });
    }

    if (action === 'reject') {
      const rejectReason = String(body.reject_reason || '').trim();

      await withMysqlTransaction(async (connection) => {
        const [paymentRows] = await connection.query<RowDataPacket[]>(
          `SELECT order_id FROM ${config.payments} WHERE id = ? LIMIT 1`,
          [pid],
        );
        const payment = paymentRows[0];
        if (!payment) {
          throw new Error('Pembayaran tidak ditemukan.');
        }

        await connection.query(
          `
            UPDATE ${config.payments}
            SET payment_status = 'rejected', reject_reason = ?
            WHERE id = ?
          `,
          [rejectReason || null, pid],
        );

        await connection.query(
          `
            UPDATE ${config.orders}
            SET ${config.statusColumn} = 'problem', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [payment.order_id],
        );

        await insertActivityLog(connection, {
          userId,
          action: 'Reject FAT',
          target: 'Validasi Pembayaran',
          details: `Tolak pembayaran ID: ${pid}${rejectReason ? ` - Alasan: ${rejectReason}` : ''}`,
        });
      });

      await emitEvent('NEW_OLAHAN');
      return NextResponse.json({ status: 'success', message: 'Pembayaran ditolak.' });
    }

    return NextResponse.json({ status: 'error', message: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error handling validasi pembayaran:', error);
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
