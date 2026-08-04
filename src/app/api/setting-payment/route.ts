import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db';
import { deleteStoredUpload, saveUploadBuffer } from '@/lib/uploadStorage';

export const dynamic = 'force-dynamic';

const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

async function uploadImage(file: File | null, existingUrl: string | null = null): Promise<string | null> {
  if (!file || typeof file === 'string') {
    return existingUrl;
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  if (!allowedExts.includes(ext)) {
    throw new Error('Ekstensi file tidak diizinkan.');
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const stored = await saveUploadBuffer(['payments'], filename, buffer);

  if (existingUrl) {
    try {
      await deleteStoredUpload(existingUrl);
    } catch (error) {
      console.error('Failed to delete old payment image', error);
    }
  }

  return stored.url;
}

export async function GET() {
  try {
    const data = await prisma.payment_accounts.findMany({
      orderBy: { bank_name: 'asc' },
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('[API /setting-payment GET]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal mengambil data rekening' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const action = String(formData.get('action') || 'create');
    const id = Number(formData.get('id') || 0);
    const bank_name = String(formData.get('bank_name') || '').trim();
    const account_name = String(formData.get('account_name') || '').trim();
    const account_number = String(formData.get('account_number') || '').trim();
    const existing_image_url = String(formData.get('existing_image_url') || '') || null;
    const paymentImage = formData.get('payment_image') as File | null;

    if (action === 'create') {
      if (!bank_name || !account_name || !account_number) {
        return NextResponse.json({ success: false, message: 'Nama Bank, Nama Pemilik, dan Nomor Rekening wajib diisi.' }, { status: 400 });
      }

      const image_url = paymentImage ? await uploadImage(paymentImage) : null;

      await prisma.payment_accounts.create({
        data: {
          bank_name,
          account_name,
          account_number,
          image_url,
        },
      });

      return NextResponse.json({ success: true, message: 'Rekening pembayaran baru berhasil ditambahkan.' });
    }

    if (action === 'update') {
      if (!id || !bank_name || !account_name || !account_number) {
        return NextResponse.json({ success: false, message: 'ID, Nama Bank, Nama Pemilik, dan Nomor Rekening wajib diisi.' }, { status: 400 });
      }

      const image_url = paymentImage ? await uploadImage(paymentImage, existing_image_url) : existing_image_url;

      await prisma.payment_accounts.update({
        where: { id },
        data: {
          bank_name,
          account_name,
          account_number,
          image_url,
        },
      });

      return NextResponse.json({ success: true, message: 'Informasi rekening berhasil diperbarui.' });
    }

    if (action === 'delete') {
      if (!id) {
        return NextResponse.json({ success: false, message: 'ID rekening wajib diisi.' }, { status: 400 });
      }

      const item = await prisma.payment_accounts.findUnique({ where: { id } });
      if (item?.image_url) {
        try {
          await deleteStoredUpload(item.image_url);
        } catch (error) {
          console.error('Failed to delete payment image', error);
        }
      }

      await prisma.payment_accounts.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Rekening pembayaran berhasil dihapus.' });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[API /setting-payment POST]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal memproses rekening pembayaran' }, { status: 500 });
  }
}
