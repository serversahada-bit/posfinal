import { NextRequest, NextResponse } from 'next/server';
import { Prisma, product_bundles_status } from '@prisma/client';

import prisma from '@/lib/db';
import { emitEvent } from '@/lib/socket-server';
import { deleteStoredUpload, saveUploadBuffer } from '@/lib/uploadStorage';

export const dynamic = 'force-dynamic';

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');
const isBundleStatus = (value: string): value is product_bundles_status => value === 'active' || value === 'inactive';

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
  const filename = `bundle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const stored = await saveUploadBuffer(['products'], filename, buffer);

  if (existingUrl) {
    try {
      await deleteStoredUpload(existingUrl);
    } catch (error) {
      console.error('Failed to delete old bundle image', error);
    }
  }

  return stored.url;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const statusParam = searchParams.get('status') ?? 'active';
    const search = searchParams.get('search') ?? '';

    const whereClause: Prisma.product_bundlesWhereInput = {};

    if (statusParam !== 'all' && isBundleStatus(statusParam)) {
      whereClause.status = statusParam;
    }

    if (search) {
      whereClause.OR = [
        { bundle_name: { contains: search } },
        { sku: { contains: search } },
      ];
    }

    const bundles = await prisma.product_bundles.findMany({
      where: whereClause,
      include: {
        product_bundle_items: {
          include: {
            products: {
              select: {
                product_name: true,
                sku: true,
              },
            },
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
      orderBy: { bundle_name: 'asc' },
    });

    const data = bundles.map((bundle) => ({
      id: bundle.id,
      bundle_name: bundle.bundle_name,
      sku: bundle.sku,
      price: Number(bundle.price),
      status: bundle.status,
      image_url: bundle.image_url,
      items: bundle.product_bundle_items.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        qty: item.qty,
        product_name: item.products.product_name,
        sku: item.products.sku,
      })),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[API /bundling GET]', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data bundling' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const isFormData = request.headers.get('content-type')?.includes('multipart/form-data');

    if (!isFormData) {
      return NextResponse.json({ success: false, message: 'Request harus multipart/form-data' }, { status: 400 });
    }

    const formData = await request.formData();
    const action = String(formData.get('action') || 'create');
    const id = Number(formData.get('id') || 0);
    const bundle_name = String(formData.get('bundle_name') || '').trim();
    const sku = String(formData.get('sku') || '').trim();
    const price = Number(formData.get('price') || 0);
    const statusRaw = String(formData.get('status') || 'active');
    const status = isBundleStatus(statusRaw) ? statusRaw : 'active';
    const existing_image_url = String(formData.get('existing_image_url') || '') || null;
    const file = formData.get('product_image') as File | null;

    const productIds = formData.getAll('product_ids[]').map((value) => Number(value)).filter((value) => value > 0);
    const qtys = formData.getAll('qtys[]').map((value) => Number(value));
    const items = productIds
      .map((productId, index) => ({
        product_id: productId,
        qty: qtys[index] || 0,
      }))
      .filter((item) => item.product_id > 0 && item.qty > 0);

    if (action === 'create') {
      if (!bundle_name || !sku) {
        return NextResponse.json({ success: false, message: 'Nama Bundling dan SKU wajib diisi.' }, { status: 400 });
      }

      if (items.length === 0) {
        return NextResponse.json({ success: false, message: 'Minimal harus ada satu produk di dalam bundling.' }, { status: 400 });
      }

      const existingBundle = await prisma.product_bundles.count({ where: { sku } });
      if (existingBundle > 0) {
        return NextResponse.json({ success: false, message: 'SKU sudah terdaftar untuk bundling lain.' }, { status: 400 });
      }

      const imageUrl = file ? await uploadImage(file) : null;

      await prisma.$transaction(async (tx) => {
        const bundle = await tx.product_bundles.create({
          data: {
            bundle_name,
            sku,
            price: Number.isFinite(price) ? price : 0,
            status,
            image_url: imageUrl,
          },
        });

        await tx.product_bundle_items.createMany({
          data: items.map((item) => ({
            bundle_id: bundle.id,
            product_id: item.product_id,
            qty: item.qty,
          })),
        });
      });

      await emitEvent('REFRESH_BUNDLES');
      return NextResponse.json({ success: true, message: 'Bundling baru berhasil ditambahkan.' });
    }

    if (action === 'update') {
      if (!id || !bundle_name || !sku) {
        return NextResponse.json({ success: false, message: 'ID, Nama Bundling, dan SKU wajib diisi.' }, { status: 400 });
      }

      if (items.length === 0) {
        return NextResponse.json({ success: false, message: 'Minimal harus ada satu produk di dalam bundling.' }, { status: 400 });
      }

      const existingBundle = await prisma.product_bundles.count({
        where: {
          sku,
          id: { not: id },
        },
      });

      if (existingBundle > 0) {
        return NextResponse.json({ success: false, message: 'SKU sudah terdaftar untuk bundling lain.' }, { status: 400 });
      }

      const imageUrl = file ? await uploadImage(file, existing_image_url) : existing_image_url;

      await prisma.$transaction(async (tx) => {
        await tx.product_bundles.update({
          where: { id },
          data: {
            bundle_name,
            sku,
            price: Number.isFinite(price) ? price : 0,
            status,
            image_url: imageUrl,
          },
        });

        await tx.product_bundle_items.deleteMany({
          where: { bundle_id: id },
        });

        await tx.product_bundle_items.createMany({
          data: items.map((item) => ({
            bundle_id: id,
            product_id: item.product_id,
            qty: item.qty,
          })),
        });
      });

      await emitEvent('REFRESH_BUNDLES');
      return NextResponse.json({ success: true, message: 'Informasi bundling berhasil diperbarui.' });
    }

    if (action === 'delete') {
      if (!id) {
        return NextResponse.json({ success: false, message: 'ID bundling wajib diisi.' }, { status: 400 });
      }

      const bundle = await prisma.product_bundles.findUnique({ where: { id } });

      if (bundle?.image_url) {
        try {
          await deleteStoredUpload(bundle.image_url);
        } catch (error) {
          console.error('Failed to delete bundle image', error);
        }
      }

      await prisma.product_bundles.delete({ where: { id } });
      await emitEvent('REFRESH_BUNDLES');
      return NextResponse.json({ success: true, message: 'Bundling berhasil dihapus.' });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[API /bundling POST]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal memproses bundling' }, { status: 500 });
  }
}

