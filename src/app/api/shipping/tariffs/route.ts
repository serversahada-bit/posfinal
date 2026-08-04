import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db';
import * as xlsx from 'xlsx';

export const dynamic = 'force-dynamic';

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');
const PAGE_SIZE = 50;
const IMPORT_BATCH_SIZE = 250;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const search = (searchParams.get('search') || '').trim();

    const where = search
      ? {
          OR: [
            { nama_tujuan: { contains: search } },
            { kurir: { contains: search } },
            { kode_asal: { contains: search } },
          ],
        }
      : {};

    const [totalRows, items, couriers] = await Promise.all([
      prisma.tarif_pengiriman.count({ where }),
      prisma.tarif_pengiriman.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.couriers.findMany({
        distinct: ['courier_name'],
        select: { courier_name: true },
        orderBy: { courier_name: 'asc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items,
        couriers,
        page,
        totalPages: Math.max(1, Math.ceil(totalRows / PAGE_SIZE)),
        totalRows,
      },
    });
  } catch (error: unknown) {
    console.error('[API /shipping/tariffs GET]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal mengambil data tarif ongkir' }, { status: 500 });
  }
}

const normalizeOriginCode = (value: string) => {
  const cleanValue = value.trim();
  const compactValue = cleanValue.replace(/\s+/g, ' ');

  if (/^madiun/i.test(compactValue) || compactValue === '39900') return 'Madiun (39900)';
  if (/^bekasi/i.test(compactValue) || /^beka i/i.test(compactValue) || compactValue === '6573') return 'Bekasi (6573)';
  if (/^jakarta/i.test(compactValue) || compactValue === '17665') return 'Jakarta (17665)';

  return compactValue;
};

async function handleImport(formData: FormData) {
  const file = formData.get('file_csv');
  const truncateTable = formData.get('truncate_table') === '1';

  if (!(file instanceof File)) {
    throw new Error('File gagal diunggah atau belum dipilih.');
  }

  const buffer = await file.arrayBuffer();
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to array of arrays
  const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  if (jsonData.length <= 1) {
    throw new Error('File tidak memiliki data untuk diimpor.');
  }

  // Skip header row
  const rows = jsonData.slice(1);
  const importRows: Array<{
    kode_asal: string;
    kode_tujuan: string;
    nama_tujuan: string;
    kurir: string;
    harga: string;
    estimasi: string;
    out_of_coverage: string;
  }> = [];

  rows.forEach((parts) => {
    // ID, Kode Asal, Nama Tujuan, Kurir, Harga, Estimasi, OOC
    if (parts.length >= 4) {
      const p1 = String(parts[1] || '').trim(); // Kode Asal
      const p2 = String(parts[2] || '').trim(); // Nama Tujuan
      const p3 = String(parts[3] || '').trim(); // Kurir
      const p4 = String(parts[4] || '').trim(); // Harga
      const p5 = parts.length > 5 ? String(parts[5] || '').trim() : ''; // Estimasi
      const p6 = parts.length > 6 ? String(parts[6] || '').trim() : ''; // OOC

      if (p2 && p3 && p4) {
        const kodeAsal = normalizeOriginCode(p1);
        importRows.push({
          kode_asal: kodeAsal,
          kode_tujuan: kodeAsal,
          nama_tujuan: p2,
          kurir: p3.toUpperCase(),
          harga: p4,
          estimasi: p5,
          out_of_coverage: p6,
        });
      }
    }
  });

  if (importRows.length === 0) {
    throw new Error('Tidak ada baris valid yang ditemukan dalam file. Pastikan urutan kolom sesuai standar (ID, Kode Asal, Nama Tujuan, Kurir, Harga, Estimasi, OOC).');
  }

  if (truncateTable) {
    await prisma.tarif_pengiriman.deleteMany();
  }

  for (let index = 0; index < importRows.length; index += 250) {
    const batch = importRows.slice(index, index + 250);
    await prisma.tarif_pengiriman.createMany({
      data: batch,
    });
  }

  return importRows.length;
}

export async function POST(request: NextRequest) {
  try {
    const isMultipart = request.headers.get('content-type')?.includes('multipart/form-data');

    if (isMultipart) {
      const formData = await request.formData();
      const action = String(formData.get('action') || '');

      if (action === 'import_csv') {
        const count = await handleImport(formData);
        return NextResponse.json({ success: true, message: `Berhasil mengimpor ${count} baris tarif ongkir dari CSV.` });
      }

      return NextResponse.json({ success: false, message: 'Action multipart tidak valid' }, { status: 400 });
    }

    const body = await request.json();
    const action = String(body?.action || '');

    
    if (action === 'truncate') {
      await prisma.tarif_pengiriman.deleteMany();
      return NextResponse.json({ success: true, message: 'Semua data tarif ongkir berhasil dikosongkan.' });
    }

    if (action === 'create') {
      const kode_asal = String(body?.kode_asal || '').trim();
      const kode_tujuan = String(body?.kode_tujuan || '').trim();
      const nama_tujuan = String(body?.nama_tujuan || '').trim();
      const kurir = String(body?.kurir || '').trim();
      const harga = String(body?.harga || '').trim();
      const estimasi = String(body?.estimasi || '').trim();
      const out_of_coverage = String(body?.out_of_coverage || '').trim();

      if (!nama_tujuan || !kurir || !harga) {
        return NextResponse.json({ success: false, message: 'Nama Tujuan, Kurir, dan Harga wajib diisi.' }, { status: 400 });
      }

      await prisma.tarif_pengiriman.create({
        data: {
          kode_asal,
          kode_tujuan,
          nama_tujuan,
          kurir: kurir.toUpperCase(),
          harga,
          estimasi,
          out_of_coverage,
        },
      });

      return NextResponse.json({ success: true, message: 'Tarif ongkir baru berhasil ditambahkan.' });
    }

    if (action === 'update') {
      const id = Number(body?.id || 0);
      const kode_asal = String(body?.kode_asal || '').trim();
      const kode_tujuan = String(body?.kode_tujuan || '').trim();
      const nama_tujuan = String(body?.nama_tujuan || '').trim();
      const kurir = String(body?.kurir || '').trim();
      const harga = String(body?.harga || '').trim();
      const estimasi = String(body?.estimasi || '').trim();
      const out_of_coverage = String(body?.out_of_coverage || '').trim();

      if (!id || !nama_tujuan || !kurir || !harga) {
        return NextResponse.json({ success: false, message: 'Nama Tujuan, Kurir, dan Harga wajib diisi.' }, { status: 400 });
      }

      await prisma.tarif_pengiriman.update({
        where: { id },
        data: {
          kode_asal,
          kode_tujuan,
          nama_tujuan,
          kurir: kurir.toUpperCase(),
          harga,
          estimasi,
          out_of_coverage,
        },
      });

      return NextResponse.json({ success: true, message: 'Informasi tarif ongkir berhasil diperbarui.' });
    }

    if (action === 'delete') {
      const id = Number(body?.id || 0);
      if (!id) {
        return NextResponse.json({ success: false, message: 'ID tarif wajib diisi.' }, { status: 400 });
      }

      await prisma.tarif_pengiriman.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Tarif ongkir berhasil dihapus.' });
    }

    if (action === 'bulk_update_nama') {
      const selectedIds = Array.isArray(body?.selected_ids) ? body.selected_ids.map((value: unknown) => Number(value)).filter((value: number) => value > 0) : [];
      const findText = String(body?.find_text || '').trim();
      const replaceText = String(body?.replace_text || '');

      if (selectedIds.length === 0) {
        return NextResponse.json({ success: false, message: 'Pilih minimal satu data tarif ongkir.' }, { status: 400 });
      }

      if (!findText) {
        return NextResponse.json({ success: false, message: 'Teks yang ingin diganti wajib diisi.' }, { status: 400 });
      }

      const items = await prisma.tarif_pengiriman.findMany({
        where: { id: { in: selectedIds } },
      });

      await prisma.$transaction(
        items.map((item) =>
          prisma.tarif_pengiriman.update({
            where: { id: item.id },
            data: {
              nama_tujuan: (item.nama_tujuan || '').replaceAll(findText, replaceText),
            },
          })
        )
      );

      return NextResponse.json({ success: true, message: `Berhasil memperbarui nama tujuan untuk ${selectedIds.length} tarif ongkir.` });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[API /shipping/tariffs POST]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal memproses tarif ongkir' }, { status: 500 });
  }
}

