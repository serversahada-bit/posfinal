import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get('q') || '').trim();

    const regions = await prisma.tarif_pengiriman.findMany({
      where: q
        ? {
            nama_tujuan: { contains: q },
          }
        : undefined,
      distinct: ['nama_tujuan'],
      select: { nama_tujuan: true },
      take: 50,
    });

    const results = regions
      .map((item) => ({
        id: item.nama_tujuan || '',
        text: item.nama_tujuan || '',
      }))
      .filter((item) => item.id && item.text);

    return NextResponse.json(results);
  } catch (error) {
    console.error('[API /warehouses/regions GET]', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil daftar wilayah' }, { status: 500 });
  }
}
