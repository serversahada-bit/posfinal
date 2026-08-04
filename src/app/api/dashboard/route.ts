import { type RowDataPacket } from 'mysql2/promise';

import { getMysqlPool } from '@/lib/mysql';

type CountRow = RowDataPacket & {
  total: number;
};

type AmountRow = RowDataPacket & {
  total: number;
};

type ChartRow = RowDataPacket & {
  chart_date: string | Date;
  total_orders: number;
  total_amount: number;
};

type RecentOrderRow = RowDataPacket & {
  order_code: string;
  customer_name: string;
  total_payment: number;
  order_status: string;
  created_at: Date | string;
  ready_at: Date | string | null;
  source_label: string;
};

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getMysqlPool();

    const [totalRows, customerRows, productRows, readyRows, chartRows, recentRows] = await Promise.all([
      pool.query<CountRow[]>('SELECT COUNT(*) AS total FROM orders WHERE status_pesanan <> ?', ['cancelled']),
      pool.query<CountRow[]>('SELECT COUNT(*) AS total FROM customers'),
      pool.query<CountRow[]>('SELECT COUNT(*) AS total FROM products'),
      pool.query<AmountRow[]>(
        `
          SELECT
            COUNT(*) AS total_orders,
            COALESCE(SUM(total_pembayaran), 0) AS total
          FROM orders
          WHERE status_pesanan = 'ready_to_ship'
        `,
      ),
      pool.query<ChartRow[]>(
        `
          SELECT
            DATE(COALESCE(processing_at, updated_at, created_at)) AS chart_date,
            COUNT(*) AS total_orders,
            COALESCE(SUM(total_pembayaran), 0) AS total_amount
          FROM orders
          WHERE status_pesanan = 'ready_to_ship'
          GROUP BY DATE(COALESCE(processing_at, updated_at, created_at))
          ORDER BY chart_date DESC
          LIMIT 14
        `,
      ),
      pool.query<RecentOrderRow[]>(
        `
          SELECT
            unique_code AS order_code,
            first_name AS customer_name,
            total_pembayaran AS total_payment,
            status_pesanan AS order_status,
            created_at,
            COALESCE(processing_at, updated_at, created_at) AS ready_at,
            CASE
              WHEN order_source = 'RESEND' OR keterangan LIKE '[RESEND]%' THEN 'RESEND'
              WHEN order_source = 'CRM' THEN 'CRM'
              WHEN order_source = 'CSO_AUTO' THEN 'CSO'
              ELSE 'CSO AKUISISI'
            END AS source_label
          FROM orders
          ORDER BY created_at DESC
          LIMIT 6
        `,
      ),
    ]);

    const readySummary = readyRows[0][0] as (AmountRow & { total_orders?: number }) | undefined;
    const chartData = [...chartRows[0]]
      .reverse()
      .map((row) => ({
        date: row.chart_date,
        total_orders: Number(row.total_orders || 0),
        total_amount: Number(row.total_amount || 0),
      }));

    return Response.json({
      success: true,
      data: {
        totalOrders: Number(totalRows[0][0]?.total || 0),
        totalCustomers: Number(customerRows[0][0]?.total || 0),
        totalProducts: Number(productRows[0][0]?.total || 0),
        readyToShipOrders: Number(readySummary?.total_orders || 0),
        readyToShipAmount: Number(readySummary?.total || 0),
        readyToShipChart: chartData,
        recentOrders: recentRows[0].map((row) => ({
          order_code: row.order_code,
          customer_name: row.customer_name,
          total_payment: Number(row.total_payment || 0),
          order_status: row.order_status,
          created_at: row.created_at,
          ready_at: row.ready_at,
          source_label: row.source_label,
        })),
      },
    });
  } catch (error) {
    console.error('[API /dashboard]', error);
    return Response.json(
      { success: false, message: 'Gagal mengambil data dashboard. Pastikan DB aktif.' },
      { status: 500 },
    );
  }
}
