import { NextRequest, NextResponse } from 'next/server';
import { saveUploadBuffer } from '@/lib/uploadStorage';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang diupload' }, { status: 400 });
    }

    // Validasi tipe file
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipe file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.' }, { status: 400 });
    }

    // Validasi ukuran file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file terlalu besar. Maksimal 5MB.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate nama file unik
    const ext = file.name.split('.').pop();
    const filename = `lp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { url } = await saveUploadBuffer(['lp'], filename, buffer);
    return NextResponse.json({ url }, { status: 200 });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Gagal mengupload file', details: error.message }, { status: 500 });
  }
}
