import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const kodeAsalMap: Record<string, string> = {
  '39900': 'Madiun (39900)',
  '6573': 'Bekasi (6573)',
  '17665': 'Jakarta (17665)',
};

const getRows = async (search: string) => {
  const where = search
    ? {
        OR: [
          { nama_tujuan: { contains: search } },
          { kurir: { contains: search } },
          { kode_asal: { contains: search } },
        ],
      }
    : {};

  return prisma.tarif_pengiriman.findMany({
    where,
    orderBy: { id: 'desc' },
  });
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const format = (searchParams.get('format') || 'csv').toLowerCase();
    const search = (searchParams.get('search') || '').trim();
    const rows = await getRows(search);

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Tarif Ongkir');
      sheet.addRow(['ID', 'Kode Asal', 'Nama Tujuan', 'Kurir', 'Harga', 'Estimasi', 'OOC']);
      rows.forEach((row) => {
        sheet.addRow([
          row.id,
          kodeAsalMap[row.kode_asal || ''] || row.kode_asal || '',
          row.nama_tujuan || '',
          row.kurir || '',
          row.harga || '',
          row.estimasi || '',
          row.out_of_coverage || '',
        ]);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="tarif_ongkir.xlsx"',
        },
      });
    }

    const csvRows = [
      ['ID', 'Kode Asal', 'Nama Tujuan', 'Kurir', 'Harga', 'Estimasi', 'OOC'].join(';'),
      ...rows.map((row) =>
        [
          row.id,
          kodeAsalMap[row.kode_asal || ''] || row.kode_asal || '',
          row.nama_tujuan || '',
          row.kurir || '',
          row.harga || '',
          row.estimasi || '',
          row.out_of_coverage || '',
        ]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(';')
      ),
    ].join('\n');

    return new NextResponse(csvRows, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="tarif_ongkir.csv"',
      },
    });
  } catch (error) {
    console.error('[API /shipping/tariffs/export GET]', error);
    return NextResponse.json({ success: false, message: 'Gagal export tarif ongkir' }, { status: 500 });
  }
}
