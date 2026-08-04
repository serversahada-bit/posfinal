import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

export async function GET() {
  try {
    const [warehouses, products, stockRows] = await Promise.all([
      prisma.warehouses.findMany({
        select: {
          id: true,
          warehouse_name: true,
        },
        orderBy: { warehouse_name: 'asc' },
      }),
      prisma.products.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          product_name: true,
          sku: true,
          price: true,
          image_url: true,
        },
        orderBy: { product_name: 'asc' },
      }),
      prisma.warehouse_stock.findMany({
        select: {
          product_id: true,
          warehouse_id: true,
          stock: true,
        },
      }),
    ]);

    const stockMap: Record<number, Record<number, number>> = {};
    stockRows.forEach((row) => {
      if (!stockMap[row.product_id]) {
        stockMap[row.product_id] = {};
      }
      stockMap[row.product_id][row.warehouse_id] = row.stock;
    });

    const data = products.map((product) => {
      const warehouse_stocks = stockMap[product.id] || {};
      const total_stock = Object.values(warehouse_stocks).reduce((sum, value) => sum + value, 0);

      return {
        id: product.id,
        product_name: product.product_name,
        sku: product.sku,
        price: Number(product.price || 0),
        image_url: product.image_url,
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
        products: data,
      },
    });
  } catch (error: unknown) {
    console.error('[API /stock/products GET]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal mengambil data stok produk' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body?.action || '');

    if (action !== 'update_stock') {
      return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
    }

    const productId = Number(body?.id || 0);
    const stocks = body?.warehouse_stocks && typeof body.warehouse_stocks === 'object' ? body.warehouse_stocks : {};

    if (!productId) {
      return NextResponse.json({ success: false, message: 'ID produk wajib diisi.' }, { status: 400 });
    }

    const rows = Object.entries(stocks)
      .map(([warehouseId, stock]) => ({
        product_id: productId,
        warehouse_id: Number(warehouseId),
        stock: Math.max(0, Number(stock) || 0),
      }))
      .filter((row) => row.warehouse_id > 0);

    await prisma.$transaction(
      rows.map((row) =>
        prisma.warehouse_stock.upsert({
          where: {
            product_id_warehouse_id: {
              product_id: row.product_id,
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

    return NextResponse.json({ success: true, message: 'Stok produk di semua gudang berhasil diperbarui.' });
  } catch (error: unknown) {
    console.error('[API /stock/products POST]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal memperbarui stok produk' }, { status: 500 });
  }
}
