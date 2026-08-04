import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

export async function GET() {
  try {
    const couriers = await prisma.couriers.findMany({
      orderBy: {
        id: 'desc',
      },
    });

    return NextResponse.json({ success: true, data: couriers });
  } catch (error: unknown) {
    console.error('[API /couriers GET]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal mengambil data ekspedisi' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body?.action || 'create');
    const id = Number(body?.id || 0);
    const courier_name = String(body?.courier_name || '').trim();
    const service_type = '';
    const logo_path = String(body?.logo_path || '').trim();
    const code = String(body?.code || '').trim();
    const base_weight_gram = Math.max(1, Number(body?.base_weight_gram) || 1000);
    const extra_weight_step_gram = Math.max(1, Number(body?.extra_weight_step_gram) || 1000);
    const rounding_tolerance_gram = Math.max(0, Number(body?.rounding_tolerance_gram) || 300);

    if (action === 'create') {
      if (!courier_name) {
        return NextResponse.json({ success: false, message: 'Nama Ekspedisi wajib diisi.' }, { status: 400 });
      }

      await prisma.couriers.create({
        data: {
          courier_name,
          service_type,
          logo_path: logo_path || null,
          code: code || null,
          base_weight_gram,
          extra_weight_step_gram,
          rounding_tolerance_gram,
        },
      });

      return NextResponse.json({ success: true, message: 'Ekspedisi baru berhasil ditambahkan.' });
    }

    if (action === 'update') {
      if (!id || !courier_name) {
        return NextResponse.json({ success: false, message: 'ID dan Nama Ekspedisi wajib diisi.' }, { status: 400 });
      }

      await prisma.couriers.update({
        where: { id },
        data: {
          courier_name,
          service_type,
          logo_path: logo_path || null,
          code: code || null,
          base_weight_gram,
          extra_weight_step_gram,
          rounding_tolerance_gram,
        },
      });

      return NextResponse.json({ success: true, message: 'Informasi ekspedisi berhasil diperbarui.' });
    }

    if (action === 'delete') {
      if (!id) {
        return NextResponse.json({ success: false, message: 'ID ekspedisi wajib diisi.' }, { status: 400 });
      }

      await prisma.couriers.delete({
        where: { id },
      });

      return NextResponse.json({ success: true, message: 'Ekspedisi berhasil dihapus.' });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[API /couriers POST]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal memproses ekspedisi' }, { status: 500 });
  }
}
