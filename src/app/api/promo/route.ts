import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const promos = await prisma.promos.findMany({
      orderBy: { id: 'desc' }
    });

    return NextResponse.json({ success: true, data: promos });
  } catch (error: any) {
    console.error('[API /promo GET]', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil promo: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, promo_name, promo_type, start_date, end_date, status } = body;

    const act = action || 'create';

    if (act === 'create') {
      if (!promo_name?.trim()) {
        return NextResponse.json({ success: false, message: 'Nama Promo wajib diisi.' }, { status: 400 });
      }

      await prisma.promos.create({
        data: {
          promo_name: promo_name.trim(),
          promo_type: promo_type || 'fisik',
          start_date: start_date ? new Date(start_date) : null,
          end_date: end_date ? new Date(end_date) : null,
          status: status || 'active'
        }
      });

      return NextResponse.json({ success: true, message: 'Promo baru berhasil ditambahkan.' });
    } else if (act === 'update') {
      if (!id || !promo_name?.trim()) {
        return NextResponse.json({ success: false, message: 'ID dan Nama Promo wajib diisi.' }, { status: 400 });
      }

      await prisma.promos.update({
        where: { id: Number(id) },
        data: {
          promo_name: promo_name.trim(),
          promo_type: promo_type || 'fisik',
          start_date: start_date ? new Date(start_date) : null,
          end_date: end_date ? new Date(end_date) : null,
          status: status || 'active'
        }
      });

      return NextResponse.json({ success: true, message: 'Informasi promo berhasil diperbarui.' });
    } else if (act === 'delete') {
      if (!id) {
        return NextResponse.json({ success: false, message: 'ID wajib diisi.' }, { status: 400 });
      }

      await prisma.promos.delete({
        where: { id: Number(id) }
      });

      return NextResponse.json({ success: true, message: 'Promo berhasil dihapus.' });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /promo POST]', error);
    return NextResponse.json({ success: false, message: 'Gagal memproses promo: ' + error.message }, { status: 500 });
  }
}
