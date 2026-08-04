import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { emitEvent } from '@/lib/socket-server';
import { products_status } from '@prisma/client';
import { deleteStoredUpload, saveUploadBuffer } from '@/lib/uploadStorage';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status') ?? 'active';
    const search = searchParams.get('search') ?? '';

    const whereClause: any = {};

    if (status !== 'all') {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { product_name: { contains: search } },
        { sku: { contains: search } },
      ];
    }

    const products = await prisma.products.findMany({
      where: whereClause,
      orderBy: { product_name: 'asc' },
    });

    const serializedProducts = products.map((p) => ({
      ...p,
      price: Number(p.price),
    }));

    return NextResponse.json({ success: true, data: serializedProducts });
  } catch (error) {
    console.error('[API /products GET]', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil produk' }, { status: 500 });
  }
}

async function uploadImage(file: File | null, existingUrl: string | null = null): Promise<string | null> {
  if (!file || typeof file === 'string') return existingUrl;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];

  if (!allowedExts.includes(ext)) {
    throw new Error('Ekstensi file tidak diizinkan.');
  }

  const filename = `prod_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  const stored = await saveUploadBuffer(['products'], filename, buffer);
  
  if (existingUrl) {
    try {
      await deleteStoredUpload(existingUrl);
    } catch (e) {
      console.error('Failed to delete old image', e);
    }
  }

  return stored.url;
}

export async function POST(request: NextRequest) {
  try {
    let bodyData: any = {};
    let file: File | null = null;
    let isFormData = false;

    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      isFormData = true;
      const formData = await request.formData();
      bodyData = {
        action: formData.get('action'),
        id: formData.get('id'),
        product_name: formData.get('product_name'),
        product_code: formData.get('product_code'),
        sku: formData.get('sku'),
        price: formData.get('price'),
        weight_gram: formData.get('weight_gram'),
        status: formData.get('status'),
        existing_image_url: formData.get('existing_image_url')
      };
      file = formData.get('product_image') as File | null;
    } else {
      bodyData = await request.json();
    }

    const { action, id, product_name, product_code, sku, price, weight_gram, status, existing_image_url } = bodyData;
    
    // We treat POST with action 'create'/'update'/'delete' as a single entry point if sent via FormData.
    // If no action is provided (like JSON from ProductContext), default to create.
    const act = action || 'create';

    if (act === 'create') {
      if (!product_name || !sku) {
        return NextResponse.json({ success: false, message: 'Nama Produk dan SKU wajib diisi.' }, { status: 400 });
      }

      const count = await prisma.products.count({ where: { sku } });
      if (count > 0) {
        return NextResponse.json({ success: false, message: 'SKU sudah terdaftar untuk produk lain.' }, { status: 400 });
      }

      let imageUrl = null;
      if (isFormData && file) {
        imageUrl = await uploadImage(file);
      }

      await prisma.products.create({
        data: {
          product_name,
          product_code: product_code || null,
          sku,
          price: Number(price),
          weight_gram: Number(weight_gram) || 0,
          status: (status as products_status) || 'active',
          image_url: imageUrl
        }
      });
      await emitEvent('REFRESH_PRODUCTS');
      return NextResponse.json({ success: true, message: 'Produk baru berhasil ditambahkan.' });
    } else if (act === 'update') {
      if (!id || !product_name || !sku) {
        return NextResponse.json({ success: false, message: 'ID, Nama Produk, dan SKU wajib diisi.' }, { status: 400 });
      }

      const pid = Number(id);
      const count = await prisma.products.count({ where: { sku, id: { not: pid } } });
      if (count > 0) {
        return NextResponse.json({ success: false, message: 'SKU sudah terdaftar untuk produk lain.' }, { status: 400 });
      }

      let imageUrl = existing_image_url || null;
      if (isFormData && file) {
        imageUrl = await uploadImage(file, existing_image_url);
      }

      await prisma.products.update({
        where: { id: pid },
        data: {
          product_name,
          product_code: product_code || null,
          sku,
          price: Number(price),
          weight_gram: Number(weight_gram) || 0,
          status: (status as products_status) || 'active',
          image_url: imageUrl
        }
      });
      await emitEvent('REFRESH_PRODUCTS');
      return NextResponse.json({ success: true, message: 'Informasi produk berhasil diperbarui.' });
    } else if (act === 'delete') {
      const pid = Number(id);
      
      const p = await prisma.products.findUnique({ where: { id: pid } });
      if (p?.image_url) {
        try {
          await deleteStoredUpload(p.image_url);
        } catch (e) {
          console.error(e);
        }
      }

      await prisma.products.delete({ where: { id: pid } });
      await emitEvent('REFRESH_PRODUCTS');
      return NextResponse.json({ success: true, message: 'Produk berhasil dihapus.' });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /products POST]', error);
    return NextResponse.json({ success: false, message: error.message || 'Gagal memproses produk' }, { status: 500 });
  }
}

// Preserve JSON PUT for ProductContext if used
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, product_name, sku, price, weight_gram, status } = body;

    if (!id || !product_name || price == null) {
      return NextResponse.json({ success: false, message: 'ID, nama produk, dan harga wajib diisi' }, { status: 400 });
    }

    await prisma.products.update({
      where: { id: Number(id) },
      data: {
        product_name,
        sku: sku || null,
        price: Number(price),
        weight_gram: Number(weight_gram) || 0,
        status: status || 'active',
      },
    });

    await emitEvent('REFRESH_PRODUCTS');
    return NextResponse.json({ success: true, message: 'Produk berhasil diperbarui' });
  } catch (error) {
    console.error('[API /products PUT]', error);
    return NextResponse.json({ success: false, message: 'Gagal memperbarui produk' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID produk wajib diisi' }, { status: 400 });
    }

    await prisma.products.update({
      where: { id: Number(id) },
      data: { status: 'inactive' },
    });

    await emitEvent('REFRESH_PRODUCTS');

    return NextResponse.json({ success: true, message: 'Produk berhasil dinonaktifkan' });
  } catch (error) {
    console.error('[API /products DELETE]', error);
    return NextResponse.json({ success: false, message: 'Gagal menonaktifkan produk' }, { status: 500 });
  }
}

