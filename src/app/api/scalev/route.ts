import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { scalev_status } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const scalevData = await prisma.scalev.findMany({
      orderBy: { id: 'desc' }
    });

    return NextResponse.json({ success: true, data: scalevData });
  } catch (error: any) {
    console.error('[API /scalev GET]', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data scalev: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, name, api_key, url, status } = body;

    const act = action || 'create';

    if (act === 'create') {
      if (!name?.trim()) {
        return NextResponse.json({ success: false, message: 'Nama Scalev wajib diisi.' }, { status: 400 });
      }

      await prisma.scalev.create({
        data: {
          name: name.trim(),
          api_key: api_key?.trim() || null,
          url: url?.trim() || null,
          status: (status as scalev_status) || 'active'
        }
      });

      return NextResponse.json({ success: true, message: 'Data Scalev baru berhasil ditambahkan.' });
    } else if (act === 'update') {
      if (!id || !name?.trim()) {
        return NextResponse.json({ success: false, message: 'ID dan Nama Scalev wajib diisi.' }, { status: 400 });
      }

      await prisma.scalev.update({
        where: { id: Number(id) },
        data: {
          name: name.trim(),
          api_key: api_key?.trim() || null,
          url: url?.trim() || null,
          status: (status as scalev_status) || 'active'
        }
      });

      return NextResponse.json({ success: true, message: 'Data Scalev berhasil diperbarui.' });
    } else if (act === 'delete') {
      if (!id) {
        return NextResponse.json({ success: false, message: 'ID wajib diisi.' }, { status: 400 });
      }

      await prisma.scalev.delete({
        where: { id: Number(id) }
      });

      return NextResponse.json({ success: true, message: 'Data Scalev berhasil dihapus.' });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /scalev POST]', error);
    return NextResponse.json({ success: false, message: 'Gagal memproses data scalev: ' + error.message }, { status: 500 });
  }
}
