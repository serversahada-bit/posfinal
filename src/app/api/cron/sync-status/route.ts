import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { changeScalevOrderStatus, getScalevBaseUrl } from '@/lib/scalev';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Ambil antrean dari database
    const queues = await prisma.scalev_sync_queue.findMany({
      take: 50, // Batasi 50 agar tidak timeout
      orderBy: { created_at: 'asc' }
    });

    if (queues.length === 0) {
      return NextResponse.json({ success: true, message: 'Tidak ada antrean sinkronisasi.' });
    }

    // Cari API Key Scalev yang aktif
    const scalevSetting = await prisma.scalev.findFirst({
      where: { status: 'active' },
      orderBy: { id: 'desc' }
    });

    if (!scalevSetting || !scalevSetting.api_key) {
      return NextResponse.json({ success: false, message: 'API Key Scalev belum dikonfigurasi.' }, { status: 400 });
    }

    const apiKey = scalevSetting.api_key;
    
    // Kelompokkan ID berdasarkan target_status
    const idsByStatus: Record<string, string[]> = {};
    for (const q of queues) {
      if (!idsByStatus[q.target_status]) {
        idsByStatus[q.target_status] = [];
      }
      idsByStatus[q.target_status].push(q.scalev_order_id);
    }

    const results = [];
    const successfulIds: string[] = [];

    // 2. Eksekusi API secara massal (bulk) per status
    for (const status in idsByStatus) {
      const ids = idsByStatus[status];
      
      const baseUrl = getScalevBaseUrl(scalevSetting.url);
      const result = await changeScalevOrderStatus({
        apiKey,
        baseUrl,
        orderIds: ids,
        status,
      });

      results.push({
        status: status,
        ids: ids,
        api_status: result.statusCode,
        api_response: result.data,
        message: result.message,
      });

      if (result.ok) {
        successfulIds.push(...ids);
      }
    }

    // 3. Hapus antrean yang berhasil diproses dari DB
    if (successfulIds.length > 0) {
      await prisma.scalev_sync_queue.deleteMany({
        where: {
          scalev_order_id: { in: successfulIds }
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      processed_count: queues.length,
      successful_ids: successfulIds,
      details: results 
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /cron/sync-status]', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error: ' + message }, { status: 500 });
  }
}
