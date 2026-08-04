import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { advertisers_status } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const advertisers = await prisma.advertisers.findMany({
      orderBy: { id: 'desc' }
    });

    return NextResponse.json({ success: true, data: advertisers });
  } catch (error: any) {
    console.error('[API /advertiser GET]', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil advertiser: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, name, status } = body;

    const act = action || 'create';

    if (act === 'create') {
      if (!name?.trim()) {
        return NextResponse.json({ success: false, message: 'Nama Advertiser wajib diisi.' }, { status: 400 });
      }

      await prisma.advertisers.create({
        data: {
          name: name.trim(),
          status: (status as advertisers_status) || 'active'
        }
      });

      return NextResponse.json({ success: true, message: 'Advertiser baru berhasil ditambahkan.' });
    } else if (act === 'update') {
      if (!id || !name?.trim()) {
        return NextResponse.json({ success: false, message: 'ID dan Nama Advertiser wajib diisi.' }, { status: 400 });
      }

      await prisma.advertisers.update({
        where: { id: Number(id) },
        data: {
          name: name.trim(),
          status: (status as advertisers_status) || 'active'
        }
      });

      return NextResponse.json({ success: true, message: 'Informasi advertiser berhasil diperbarui.' });
    } else if (act === 'delete') {
      if (!id) {
        return NextResponse.json({ success: false, message: 'ID wajib diisi.' }, { status: 400 });
      }

      await prisma.advertisers.delete({
        where: { id: Number(id) }
      });

      return NextResponse.json({ success: true, message: 'Advertiser berhasil dihapus.' });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /advertiser POST]', error);
    return NextResponse.json({ success: false, message: 'Gagal memproses advertiser: ' + error.message }, { status: 500 });
  }
}
