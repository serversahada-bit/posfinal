import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { changeScalevOrderStatus, getScalevBaseUrl, getScalevErrorMessage, getScalevOrderStatus } from '@/lib/scalev';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { order_id, customer_name, customer_phone, address, location_id, payment_method } = body;

    if (!order_id || !customer_name || !customer_phone || !address || !location_id || !payment_method) {
      return NextResponse.json({ success: false, message: 'Semua field wajib diisi, termasuk Kecamatan dan Metode Pembayaran.' }, { status: 400 });
    }

    // Cari API Key Scalev yang aktif
    const scalevSetting = await prisma.scalev.findFirst({
      where: { status: 'active' },
      orderBy: { id: 'desc' }
    });

    if (!scalevSetting || !scalevSetting.api_key) {
      return NextResponse.json({ success: false, message: 'API Key Scalev belum dikonfigurasi atau tidak aktif.' }, { status: 400 });
    }

    const apiKey = scalevSetting.api_key;
    const baseUrl = getScalevBaseUrl(scalevSetting.url);
    
    // 1. Update Pesanan (Isi Alamat)
    const updatePayload = {
      customer_name: customer_name,
      customer_phone: customer_phone,
      address: address,
      location_id: location_id,
      payment_method: payment_method,
    };

    const updateResponse = await fetch(`${baseUrl}/orders/${order_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(updatePayload)
    });

    const updateText = await updateResponse.text();
    let updateData: unknown = null;
    if (updateText) {
      try {
        updateData = JSON.parse(updateText);
      } catch {
        updateData = { raw: updateText };
      }
    }
    console.log('[API /scalev/complete-order] PATCH /orders response:', updateResponse.status, updateData);

    if (!updateResponse.ok) {
      const errorMsg = getScalevErrorMessage(
        updateData,
        `Gagal melengkapi data pesanan di Scalev (HTTP ${updateResponse.status})`
      );

      return NextResponse.json({ 
        success: false, 
        message: `Error Scalev: ${errorMsg}`,
        details: updateData
      }, { status: updateResponse.status });
    }

    await prisma.scalev_sync_queue.upsert({
      where: { scalev_order_id: order_id },
      update: { target_status: 'pending' },
      create: {
        scalev_order_id: order_id,
        target_status: 'pending',
      },
    });

    const pendingAttempt = await changeScalevOrderStatus({
      apiKey,
      baseUrl,
      orderIds: [order_id],
      status: 'pending',
    });

    if (pendingAttempt.ok) {
      const verification = await getScalevOrderStatus({
        apiKey,
        baseUrl,
        orderId: order_id,
      });

      if (verification.ok && verification.orderStatus === 'pending') {
        await prisma.scalev_sync_queue.deleteMany({
          where: { scalev_order_id: order_id },
        });

        return NextResponse.json({
          success: true,
          pendingSyncStatus: 'completed',
          message: 'Data pesanan berhasil dilengkapi dan status berhasil diubah ke Pending.',
          details: {
            update: updateData,
            pending_attempt: pendingAttempt.data,
            verification: verification.data,
          },
        });
      }

      return NextResponse.json({
        success: true,
        pendingSyncStatus: 'queued',
        message: 'Scalev merespons OK saat ubah status, tetapi verifikasi terakhir menunjukkan order belum menjadi Pending. Order disimpan ke antrean retry.',
        details: {
          update: updateData,
          pending_attempt: pendingAttempt.data,
          verification: verification.data,
          verification_status: verification.orderStatus,
        },
      });
    }

    return NextResponse.json({ 
      success: true, 
      pendingSyncStatus: 'queued',
      message: 'Data pesanan berhasil dilengkapi. Tahap 2 untuk ubah ke Pending belum berhasil, jadi order disimpan ke antrean retry.',
      details: {
        update: updateData,
        pending_attempt: pendingAttempt.data,
        pending_attempt_message: pendingAttempt.message,
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /scalev/complete-order POST]', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error: ' + message }, { status: 500 });
  }
}
