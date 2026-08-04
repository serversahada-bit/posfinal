import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

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

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Stok Produk');

    sheet.addRow([
      'No',
      'Nama Produk',
      'SKU',
      'Harga',
      'Total Stok',
      ...warehouses.map((warehouse) => `Stok ${warehouse.warehouse_name}`),
    ]);

    products.forEach((product, index) => {
      const warehouseStocks = stockMap[product.id] || {};
      const totalStock = Object.values(warehouseStocks).reduce((sum, value) => sum + value, 0);

      sheet.addRow([
        index + 1,
        product.product_name,
        product.sku || '',
        Number(product.price || 0),
        totalStock,
        ...warehouses.map((warehouse) => warehouseStocks[warehouse.id] || 0),
      ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="stok_produk.xlsx"',
      },
    });
  } catch (error) {
    console.error('[API /stock/products/export GET]', error);
    return NextResponse.json({ success: false, message: 'Gagal export stok produk' }, { status: 500 });
  }
}
