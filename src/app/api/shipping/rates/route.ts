import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const normalizeCourierKey = (value: unknown) => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();

function parsePriceInt(val: string | null): number {
  if (val === null || val === '-' || val === '') return 0;
  const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? 0 : num;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subdistrict = searchParams.get('subdistrict') || '';

  if (!subdistrict) {
    return NextResponse.json(
      { status: 'error', message: 'Destination subdistrict is empty' },
      { status: 400 }
    );
  }

  const parts = subdistrict.split(',').map((p) => p.trim());
  const province = parts[0] || '';
  const city = parts[1] || '';
  const district = parts[2] || '';

  const originToWarehouseIds: Record<string, number[]> = {
    madiun: [1, 2, 5],
    bekasi: [3],
    jakarta: [4],
  };

  const originCodes: Record<string, string> = {
    madiun: 'Madiun (39900)',
    bekasi: 'Bekasi (6573)',
    jakarta: 'Jakarta (17665)',
  };
  const originCodeAliases: Record<string, string[]> = {
    madiun: ['Madiun (39900)', 'Madiun (39900', '39900'],
    bekasi: ['Bekasi (6573)', 'Bekasi (6573', '6573'],
    jakarta: ['Jakarta (17665)', 'Jakarta (17665', '17665'],
  };

  const allOriginRates: Record<string, any> = {};
  const origins = ['madiun', 'bekasi', 'jakarta'];

  try {
    const courierRows = await prisma.couriers.findMany({
      select: { courier_name: true, code: true },
      orderBy: { courier_name: 'asc' },
    });

    const fallbackCourierNames = ['NINJA', 'JNT', 'JNE', 'POS', 'LION'];
    const courierAliasMap = new Map<string, string>();
    const courierDisplayNames: string[] = [];

    courierRows.forEach((courier) => {
      const displayName = String(courier.courier_name || courier.code || '').trim();
      if (!displayName) {
        return;
      }

      if (!courierDisplayNames.includes(displayName)) {
        courierDisplayNames.push(displayName);
      }

      const normalizedDisplayName = normalizeCourierKey(displayName);
      const nameKey = normalizeCourierKey(courier.courier_name);
      const codeKey = normalizeCourierKey(courier.code);
      if (normalizedDisplayName) courierAliasMap.set(normalizedDisplayName, displayName);
      if (nameKey) courierAliasMap.set(nameKey, displayName);
      if (codeKey) courierAliasMap.set(codeKey, displayName);
    });

    fallbackCourierNames.forEach((name) => {
      if (!courierDisplayNames.includes(name)) {
        courierDisplayNames.push(name);
      }
      courierAliasMap.set(normalizeCourierKey(name), name);
    });

    for (const origin of origins) {
      const kode_asal = originCodes[origin];

      // Exact match first
      let rates = await prisma.$queryRaw<any[]>`
        SELECT *
        FROM tarif_pengiriman
        WHERE kode_asal = ${kode_asal}
          AND nama_tujuan COLLATE utf8mb4_unicode_ci = CONVERT(${subdistrict} USING utf8mb4) COLLATE utf8mb4_unicode_ci
      `;

      if (rates.length === 0) {
        // Fallback LIKE match
        const cleanCity = city.replace(/kabupaten /i, '').replace(/kota /i, '').trim();
        rates = await prisma.$queryRaw<any[]>`
          SELECT *
          FROM tarif_pengiriman
          WHERE kode_asal = ${kode_asal}
            AND nama_tujuan COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CONVERT(${province} USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
            AND nama_tujuan COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CONVERT(${cleanCity} USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
            AND nama_tujuan COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CONVERT(${district} USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
        `;
      }

      if (rates.length > 0) {
        const couriers = Object.fromEntries(
          courierDisplayNames.map((name) => [name, { price: 0, estimation: '', out_of_coverage: '' }])
        );

        for (const row of rates) {
          if (!row.kurir) continue;
          const kurir = normalizeCourierKey(row.kurir);
          const canonicalCourierKey = courierAliasMap.get(kurir);
          if (canonicalCourierKey && couriers[canonicalCourierKey]) {
            couriers[canonicalCourierKey].price = parsePriceInt(row.harga);
            couriers[canonicalCourierKey].estimation = row.estimasi || '';
            couriers[canonicalCourierKey].out_of_coverage = row.out_of_coverage || '';
          }
        }

        let cheapest = Number.MAX_SAFE_INTEGER;
        for (const c in couriers) {
          const price = couriers[c].price;
          if (price > 0 && price < cheapest) {
            cheapest = price;
          }
        }
        if (cheapest === Number.MAX_SAFE_INTEGER) cheapest = 0;

        allOriginRates[origin] = {
          warehouse_ids: originToWarehouseIds[origin],
          rates: couriers,
          cheapest_price: cheapest,
        };
      }
    }

    let bestOrigin: string | null = null;
    let bestPrice = Number.MAX_SAFE_INTEGER;
    for (const origin in allOriginRates) {
      const price = allOriginRates[origin].cheapest_price;
      if (price > 0 && price < bestPrice) {
        bestPrice = price;
        bestOrigin = origin;
      }
    }

    return NextResponse.json({
      status: 'success',
      origins: allOriginRates,
      best_origin: bestOrigin,
      best_price: bestPrice === Number.MAX_SAFE_INTEGER ? 0 : bestPrice,
    });
  } catch (error: any) {
    console.error('Error fetching shipping rates:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch shipping rates' },
      { status: 500 }
    );
  }
}
