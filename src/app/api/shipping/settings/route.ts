import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

type WeightSettings = {
  default_item_weight_gram: number;
  base_weight_gram: number;
  extra_weight_step_gram: number;
  rounding_tolerance_gram: number;
};

const DEFAULT_SETTINGS: WeightSettings = {
  default_item_weight_gram: 200,
  base_weight_gram: 1000,
  extra_weight_step_gram: 1000,
  rounding_tolerance_gram: 300,
};

const sanitizeSettings = (input?: Partial<WeightSettings>): WeightSettings => ({
  default_item_weight_gram: Math.max(0, Number(input?.default_item_weight_gram) || DEFAULT_SETTINGS.default_item_weight_gram),
  base_weight_gram: Math.max(1, Number(input?.base_weight_gram) || DEFAULT_SETTINGS.base_weight_gram),
  extra_weight_step_gram: Math.max(1, Number(input?.extra_weight_step_gram) || DEFAULT_SETTINGS.extra_weight_step_gram),
  rounding_tolerance_gram: Math.max(0, Number(input?.rounding_tolerance_gram) || DEFAULT_SETTINGS.rounding_tolerance_gram),
});

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

async function getSettingsPayload() {
  const settingsRow = await prisma.shipping_weight_settings.findUnique({
    where: { id: 1 },
  });

  const settings = sanitizeSettings(
    settingsRow
      ? {
          default_item_weight_gram: settingsRow.default_item_weight_gram,
          base_weight_gram: settingsRow.base_weight_gram,
          extra_weight_step_gram: settingsRow.extra_weight_step_gram,
          rounding_tolerance_gram: settingsRow.rounding_tolerance_gram,
        }
      : DEFAULT_SETTINGS
  );

  if (!settingsRow) {
    await prisma.shipping_weight_settings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        ...settings,
      },
      update: settings,
    });
  }

  const couriers = await prisma.couriers.findMany({
    select: {
      id: true,
      courier_name: true,
      code: true,
      base_weight_gram: true,
      extra_weight_step_gram: true,
      rounding_tolerance_gram: true,
    },
    orderBy: { courier_name: 'asc' },
  });

  return {
    settings,
    couriers: couriers.map((courier) => ({
      id: courier.id,
      courier_name: courier.courier_name,
      code: courier.code,
      base_weight_gram: Math.max(1, Number(courier.base_weight_gram) || settings.base_weight_gram),
      extra_weight_step_gram: Math.max(1, Number(courier.extra_weight_step_gram) || settings.extra_weight_step_gram),
      rounding_tolerance_gram: Math.max(0, Number(courier.rounding_tolerance_gram) || settings.rounding_tolerance_gram),
    })),
  };
}

export async function GET() {
  try {
    const data = await getSettingsPayload();
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('[API /shipping/settings GET]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal mengambil pengaturan ongkir' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const settings = sanitizeSettings(body?.settings);
    const courierRules = Array.isArray(body?.courier_rules) ? body.courier_rules : [];

    await prisma.$transaction(async (tx) => {
      await tx.shipping_weight_settings.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          ...settings,
        },
        update: settings,
      });

      for (const rule of courierRules) {
        const courierId = Number(rule?.id);
        if (!courierId) {
          continue;
        }

        await tx.couriers.update({
          where: { id: courierId },
          data: {
            base_weight_gram: Math.max(1, Number(rule?.base_weight_gram) || settings.base_weight_gram),
            extra_weight_step_gram: Math.max(1, Number(rule?.extra_weight_step_gram) || settings.extra_weight_step_gram),
            rounding_tolerance_gram: Math.max(0, Number(rule?.rounding_tolerance_gram) || 0),
          },
        });
      }
    });

    const data = await getSettingsPayload();
    return NextResponse.json({ success: true, data, message: 'Pengaturan estimasi ongkir berhasil disimpan.' });
  } catch (error: unknown) {
    console.error('[API /shipping/settings POST]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal menyimpan pengaturan ongkir' }, { status: 500 });
  }
}
