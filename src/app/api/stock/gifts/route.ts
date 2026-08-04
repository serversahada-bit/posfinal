import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

export async function GET() {
  try {
    const [warehouses, gifts, stockRows] = await Promise.all([
      prisma.warehouses.findMany({
        select: {
          id: true,
          warehouse_name: true,
        },
        orderBy: { warehouse_name: 'asc' },
      }),
      prisma.gifts.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          gift_name: true,
          sku: true,
          price: true,
          image_url: true,
        },
        orderBy: { gift_name: 'asc' },
      }),
      prisma.warehouse_gift_stock.findMany({
        select: {
          gift_id: true,
          warehouse_id: true,
          stock: true,
        },
      }),
    ]);

    const stockMap: Record<number, Record<number, number>> = {};
    stockRows.forEach((row) => {
      if (!stockMap[row.gift_id]) {
        stockMap[row.gift_id] = {};
      }
      stockMap[row.gift_id][row.warehouse_id] = row.stock;
    });

    const data = gifts.map((gift) => {
      const warehouse_stocks = stockMap[gift.id] || {};
      const total_stock = Object.values(warehouse_stocks).reduce((sum, value) => sum + value, 0);

      return {
        id: gift.id,
        gift_name: gift.gift_name,
        sku: gift.sku,
        price: Number(gift.price || 0),
        image_url: gift.image_url,
        total_stock,
        warehouse_stocks: Object.fromEntries(
          Object.entries(warehouse_stocks).map(([warehouseId, stock]) => [String(warehouseId), stock])
        ),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        warehouses,
        gifts: data,
      },
    });
  } catch (error: unknown) {
    console.error('[API /stock/gifts GET]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal mengambil data stok hadiah' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body?.action || '');

    if (action !== 'update_stock') {
      return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
    }

    const giftId = Number(body?.id || 0);
    const stocks = body?.warehouse_stocks && typeof body.warehouse_stocks === 'object' ? body.warehouse_stocks : {};

    if (!giftId) {
      return NextResponse.json({ success: false, message: 'ID hadiah wajib diisi.' }, { status: 400 });
    }

    const rows = Object.entries(stocks)
      .map(([warehouseId, stock]) => ({
        gift_id: giftId,
        warehouse_id: Number(warehouseId),
        stock: Math.max(0, Number(stock) || 0),
      }))
      .filter((row) => row.warehouse_id > 0);

    await prisma.$transaction(
      rows.map((row) =>
        prisma.warehouse_gift_stock.upsert({
          where: {
            gift_id_warehouse_id: {
              gift_id: row.gift_id,
              warehouse_id: row.warehouse_id,
            },
          },
          create: row,
          update: {
            stock: row.stock,
          },
        })
      )
    );

    return NextResponse.json({ success: true, message: 'Stok hadiah di semua gudang berhasil diperbarui.' });
  } catch (error: unknown) {
    console.error('[API /stock/gifts POST]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal memperbarui stok hadiah' }, { status: 500 });
  }
}
