import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db';
import { deleteStoredUpload, saveUploadBuffer } from '@/lib/uploadStorage';

export const dynamic = 'force-dynamic';

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

async function uploadImage(file: File | null, existingUrl: string | null = null): Promise<string | null> {
  if (!file || typeof file === 'string') {
    return existingUrl;
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];

  if (!allowedExts.includes(ext)) {
    throw new Error('Ekstensi file tidak diizinkan.');
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const stored = await saveUploadBuffer(['warehouses'], filename, buffer);

  if (existingUrl) {
    try {
      await deleteStoredUpload(existingUrl);
    } catch (error) {
      console.error('Failed to delete old warehouse image', error);
    }
  }

  return stored.url;
}

export async function GET() {
  try {
    const warehouses = await prisma.warehouses.findMany({
      orderBy: { warehouse_name: 'asc' },
    });

    return NextResponse.json({ success: true, data: warehouses });
  } catch (error: unknown) {
    console.error('[API /warehouses GET]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal mengambil data gudang' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const isMultipart = request.headers.get('content-type')?.includes('multipart/form-data');
    if (!isMultipart) {
      return NextResponse.json({ success: false, message: 'Request harus multipart/form-data' }, { status: 400 });
    }

    const formData = await request.formData();
    const action = String(formData.get('action') || '');
    const id = Number(formData.get('id') || 0);
    const warehouse_name = String(formData.get('warehouse_name') || '').trim();
    const code = String(formData.get('code') || '').trim();
    const address = String(formData.get('address') || '').trim();
    const pic_name = String(formData.get('pic_name') || '').trim();
    const distance_km = Number(formData.get('distance_km') || 0);
    const fullRegion = String(formData.get('subdistrict') || '').trim();
    const existing_image_url = String(formData.get('existing_image_url') || '') || null;
    const file = formData.get('warehouse_image') as File | null;

    const parts = fullRegion.split(',').map((part) => part.trim());
    const district = parts[0] || '';
    const city = parts[1] || '';
    const province = parts[2] || '';

    if (action === 'create') {
      if (!warehouse_name || !code || !fullRegion) {
        return NextResponse.json({ success: false, message: 'Nama Gudang, Kode Gudang, dan Wilayah wajib diisi.' }, { status: 400 });
      }

      const imageUrl = file ? await uploadImage(file) : null;

      await prisma.warehouses.create({
        data: {
          warehouse_name,
          code,
          address: address || null,
          district: district || null,
          city: city || null,
          province: province || null,
          pic_name: pic_name || null,
          distance_km: Number.isFinite(distance_km) ? Math.round(distance_km) : 0,
          image_url: imageUrl,
        },
      });

      return NextResponse.json({ success: true, message: 'Gudang baru berhasil ditambahkan.' });
    }

    if (action === 'update') {
      if (!id || !warehouse_name || !code || !fullRegion) {
        return NextResponse.json({ success: false, message: 'Nama Gudang, Kode Gudang, dan Wilayah wajib diisi.' }, { status: 400 });
      }

      const imageUrl = file ? await uploadImage(file, existing_image_url) : existing_image_url;

      await prisma.warehouses.update({
        where: { id },
        data: {
          warehouse_name,
          code,
          address: address || null,
          district: district || null,
          city: city || null,
          province: province || null,
          pic_name: pic_name || null,
          distance_km: Number.isFinite(distance_km) ? Math.round(distance_km) : 0,
          image_url: imageUrl,
        },
      });

      return NextResponse.json({ success: true, message: 'Informasi gudang berhasil diperbarui.' });
    }

    if (action === 'delete') {
      if (!id) {
        return NextResponse.json({ success: false, message: 'ID gudang wajib diisi.' }, { status: 400 });
      }

      const warehouse = await prisma.warehouses.findUnique({ where: { id } });
      if (warehouse?.image_url) {
        try {
          await deleteStoredUpload(warehouse.image_url);
        } catch (error) {
          console.error('Failed to delete warehouse image', error);
        }
      }

      await prisma.warehouses.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Gudang berhasil dihapus.' });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[API /warehouses POST]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal memproses gudang' }, { status: 500 });
  }
}
