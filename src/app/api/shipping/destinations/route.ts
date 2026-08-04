import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const term = q.trim();

  try {
    let destinations;
    if (term === '') {
      destinations = await prisma.tarif_pengiriman.findMany({
        distinct: ['nama_tujuan'],
        select: { nama_tujuan: true },
        take: 50,
      });
    } else {
      destinations = await prisma.tarif_pengiriman.findMany({
        where: {
          nama_tujuan: { contains: term },
        },
        distinct: ['nama_tujuan'],
        select: { nama_tujuan: true },
        take: 50,
      });
    }

    const results = destinations.map((d) => ({
      id: d.nama_tujuan,
      text: d.nama_tujuan,
    }));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error fetching destinations:', error);
    return NextResponse.json(
      { error: 'Failed to search destinations' },
      { status: 500 }
    );
  }
}
