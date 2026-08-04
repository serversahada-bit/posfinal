import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

type OriginCode = 'madiun' | 'bekasi' | 'jakarta';

const FALLBACK_COURIERS = ['Ninja', 'JNT', 'JNE', 'Sicepat', 'POS'];
const ORIGINS: Record<OriginCode, string> = {
  madiun: 'Madiun',
  bekasi: 'Bekasi',
  jakarta: 'Jakarta',
};
const ORIGIN_KEYS: OriginCode[] = ['madiun', 'bekasi', 'jakarta'];

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');
const normalizeCourierCode = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();

async function buildPayload() {
  const courierRows = await prisma.couriers.findMany({
    select: {
      courier_name: true,
    },
    orderBy: {
      courier_name: 'asc',
    },
  });

  const couriers = courierRows.map((row) => row.courier_name).filter((value): value is string => Boolean(value && value.trim()));
  const normalizedCouriers = couriers.length > 0 ? couriers : FALLBACK_COURIERS;

  const settings = await prisma.ongkir_settings.findMany({
    orderBy: [{ courier_code: 'asc' }, { origin_code: 'asc' }],
  });

  return {
    couriers: normalizedCouriers,
    origins: ORIGINS,
    settings: settings.map((row) => ({
      courier_code: row.courier_code || '',
      origin_code: (row.origin_code || 'jakarta') as OriginCode,
      disc_percent: Number(row.disc_percent || 0),
      gudang_fee: Number(row.gudang_fee || 0),
      cod_fee_percent: Number(row.cod_fee_percent || 0),
    })),
  };
}

export async function GET() {
  try {
    const data = await buildPayload();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('[API /shipping/cost-settings GET]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal mengambil pengaturan biaya ongkir' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const settingsInput = body?.settings && typeof body.settings === 'object' ? body.settings : {};

    const rowMap = new Map<string, {
      courier_code: string;
      origin_code: OriginCode;
      disc_percent: number;
      gudang_fee: number;
      cod_fee_percent: number;
    }>();

    Object.entries(settingsInput).forEach(([courierCode, originMap]) => {
      if (!originMap || typeof originMap !== 'object') {
        return;
      }

      const normalizedCourierCode = normalizeCourierCode(courierCode);
      if (!normalizedCourierCode) {
        return;
      }

      ORIGIN_KEYS.forEach((origin) => {
        const row = (originMap as Record<string, { disc?: string; gudang?: string; cod_fee?: string }>)[origin] || {};
        rowMap.set(`${normalizedCourierCode}::${origin}`, {
          courier_code: normalizedCourierCode,
          origin_code: origin,
          disc_percent: Number(row.disc || 0),
          gudang_fee: Number(row.gudang || 0),
          cod_fee_percent: Number(row.cod_fee || 0),
        });
      });
    });

    const rows = Array.from(rowMap.values());

    await prisma.$transaction(async (tx) => {
      await tx.ongkir_settings.deleteMany();

      if (rows.length > 0) {
        await tx.ongkir_settings.createMany({
          data: rows,
          skipDuplicates: true,
        });
      }
    });

    const data = await buildPayload();
    return NextResponse.json({ success: true, data, message: 'Pengaturan Biaya Ongkir berhasil disimpan.' });
  } catch (error: unknown) {
    console.error('[API /shipping/cost-settings POST]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal menyimpan pengaturan biaya ongkir' }, { status: 500 });
  }
}
