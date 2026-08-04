import { NextRequest, NextResponse } from 'next/server';
import { Prisma, gifts_status } from '@prisma/client';

import prisma from '@/lib/db';
import { emitEvent } from '@/lib/socket-server';
import { deleteStoredUpload, saveUploadBuffer } from '@/lib/uploadStorage';

export const dynamic = 'force-dynamic';

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');
const isGiftStatus = (value: string): value is gifts_status => value === 'active' || value === 'inactive';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const statusParam = searchParams.get('status') ?? 'active';
    const search = searchParams.get('search') ?? '';

    const whereClause: Prisma.giftsWhereInput = {};

    if (statusParam !== 'all' && isGiftStatus(statusParam)) {
      whereClause.status = statusParam;
    }

    if (search) {
      whereClause.OR = [
        { gift_name: { contains: search } },
        { sku: { contains: search } },
      ];
    }

    const gifts = await prisma.gifts.findMany({
      where: whereClause,
      orderBy: { gift_name: 'asc' },
    });

    const serializedGifts = gifts.map((gift) => ({
      ...gift,
      price: Number(gift.price),
    }));

    return NextResponse.json({ success: true, data: serializedGifts });
  } catch (error) {
    console.error('[API /gifts GET]', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data hadiah' }, { status: 500 });
  }
}

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
  const filename = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const stored = await saveUploadBuffer(['gifts'], filename, buffer);

  if (existingUrl) {
    try {
      await deleteStoredUpload(existingUrl);
    } catch (error) {
      console.error('Failed to delete old gift image', error);
    }
  }

  return stored.url;
}

export async function POST(request: NextRequest) {
  try {
    const isFormData = request.headers.get('content-type')?.includes('multipart/form-data');

    if (!isFormData) {
      return NextResponse.json({ success: false, message: 'Request harus multipart/form-data' }, { status: 400 });
    }

    const formData = await request.formData();
    const action = String(formData.get('action') || 'create');
    const id = formData.get('id');
    const gift_name = String(formData.get('gift_name') || '').trim();
    const sku = String(formData.get('sku') || '').trim();
    const weight_gram = Number(formData.get('weight_gram') || 0);
    const status = String(formData.get('status') || 'active') as gifts_status;
    const existing_image_url = String(formData.get('existing_image_url') || '') || null;
    const file = formData.get('gift_image') as File | null;

    if (action === 'create') {
      if (!gift_name || !sku) {
        return NextResponse.json({ success: false, message: 'Nama Hadiah dan SKU wajib diisi.' }, { status: 400 });
      }

      const existingGift = await prisma.gifts.count({ where: { sku } });
      if (existingGift > 0) {
        return NextResponse.json({ success: false, message: 'SKU sudah terdaftar untuk hadiah lain.' }, { status: 400 });
      }

      const imageUrl = file ? await uploadImage(file) : null;

      await prisma.gifts.create({
        data: {
          gift_name,
          sku,
          price: 0,
          weight_gram: Number.isFinite(weight_gram) ? weight_gram : 0,
          status,
          image_url: imageUrl,
        },
      });

      await emitEvent('REFRESH_GIFTS');
      return NextResponse.json({ success: true, message: 'Hadiah baru berhasil ditambahkan.' });
    }

    if (action === 'update') {
      const giftId = Number(id);

      if (!giftId || !gift_name || !sku) {
        return NextResponse.json({ success: false, message: 'ID, Nama Hadiah, dan SKU wajib diisi.' }, { status: 400 });
      }

      const existingGift = await prisma.gifts.count({
        where: {
          sku,
          id: { not: giftId },
        },
      });

      if (existingGift > 0) {
        return NextResponse.json({ success: false, message: 'SKU sudah terdaftar untuk hadiah lain.' }, { status: 400 });
      }

      const imageUrl = file ? await uploadImage(file, existing_image_url) : existing_image_url;

      await prisma.gifts.update({
        where: { id: giftId },
        data: {
          gift_name,
          sku,
          price: 0,
          weight_gram: Number.isFinite(weight_gram) ? weight_gram : 0,
          status,
          image_url: imageUrl,
        },
      });

      await emitEvent('REFRESH_GIFTS');
      return NextResponse.json({ success: true, message: 'Informasi hadiah berhasil diperbarui.' });
    }

    if (action === 'delete') {
      const giftId = Number(id);

      if (!giftId) {
        return NextResponse.json({ success: false, message: 'ID hadiah wajib diisi.' }, { status: 400 });
      }

      const gift = await prisma.gifts.findUnique({ where: { id: giftId } });

      if (gift?.image_url) {
        try {
          await deleteStoredUpload(gift.image_url);
        } catch (error) {
          console.error('Failed to delete gift image', error);
        }
      }

      await prisma.gifts.delete({ where: { id: giftId } });
      await emitEvent('REFRESH_GIFTS');
      return NextResponse.json({ success: true, message: 'Hadiah berhasil dihapus.' });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[API /gifts POST]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal memproses hadiah' }, { status: 500 });
  }
}

