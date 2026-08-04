import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { ad_sources_status } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const adSources = await prisma.ad_sources.findMany({
      orderBy: { id: 'desc' }
    });

    return NextResponse.json({ success: true, data: adSources });
  } catch (error: any) {
    console.error('[API /ad_source GET]', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil ad_source: ' + error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, name, status } = body;

    const act = action || 'create';

    if (act === 'create') {
      if (!name?.trim()) {
        return NextResponse.json({ success: false, message: 'Nama Sumber Iklan wajib diisi.' }, { status: 400 });
      }

      await prisma.ad_sources.create({
        data: {
          name: name.trim(),
          status: (status as ad_sources_status) || 'active'
        }
      });

      return NextResponse.json({ success: true, message: 'Sumber iklan baru berhasil ditambahkan.' });
    } else if (act === 'update') {
      if (!id || !name?.trim()) {
        return NextResponse.json({ success: false, message: 'ID dan Nama Sumber Iklan wajib diisi.' }, { status: 400 });
      }

      await prisma.ad_sources.update({
        where: { id: Number(id) },
        data: {
          name: name.trim(),
          status: (status as ad_sources_status) || 'active'
        }
      });

      return NextResponse.json({ success: true, message: 'Informasi sumber iklan berhasil diperbarui.' });
    } else if (act === 'delete') {
      if (!id) {
        return NextResponse.json({ success: false, message: 'ID wajib diisi.' }, { status: 400 });
      }

      await prisma.ad_sources.delete({
        where: { id: Number(id) }
      });

      return NextResponse.json({ success: true, message: 'Sumber iklan berhasil dihapus.' });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /ad_source POST]', error);
    return NextResponse.json({ success: false, message: 'Gagal memproses ad_source: ' + error.message }, { status: 500 });
  }
}
