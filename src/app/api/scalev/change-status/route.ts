import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { changeScalevOrderStatus, getScalevBaseUrl, getScalevOrderStatus } from '@/lib/scalev';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { order_ids, status } = body;

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json({ success: false, message: 'Order IDs wajib diisi.' }, { status: 400 });
    }
    
    if (!status) {
      return NextResponse.json({ success: false, message: 'Status wajib diisi.' }, { status: 400 });
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
    
    const result = await changeScalevOrderStatus({
      apiKey,
      baseUrl,
      orderIds: order_ids,
      status,
    });

    if (!result.ok) {
      return NextResponse.json({ 
        success: false, 
        message: result.message,
        details: result.data
      }, { status: result.statusCode });
    }

    const verification = await Promise.all(
      order_ids.map(async (orderId: string) => {
        const statusResult = await getScalevOrderStatus({
          apiKey,
          baseUrl,
          orderId,
        });

        return {
          order_id: orderId,
          verified: statusResult.ok && statusResult.orderStatus === status,
          actual_status: statusResult.orderStatus,
          verification_message: statusResult.message,
          verification_details: statusResult.data,
        };
      })
    );

    const mismatchedOrders = verification.filter((item) => !item.verified);

    if (mismatchedOrders.length > 0) {
      return NextResponse.json({
        success: false,
        message: `Scalev merespons OK, tetapi ${mismatchedOrders.length} order belum benar-benar berubah ke status ${status}.`,
        data: result.data,
        verification,
      }, { status: 409 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Status pesanan berhasil diubah di Scalev.',
      data: result.data,
      verification,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /scalev/change-status POST]', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error: ' + message }, { status: 500 });
  }
}
