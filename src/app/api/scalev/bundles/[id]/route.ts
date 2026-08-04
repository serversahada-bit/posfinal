import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bundleId } = await params;

    if (!bundleId) {
      return NextResponse.json({ success: false, message: 'ID Bundling tidak valid.' }, { status: 400 });
    }

    // Cari API Key Scalev yang aktif
    const scalevSetting = await prisma.scalev.findFirst({
      where: { status: 'active' },
      orderBy: { id: 'desc' }
    });

    if (!scalevSetting || !scalevSetting.api_key) {
      return NextResponse.json({ success: false, message: 'API Key Scalev belum dikonfigurasi atau tidak aktif.' }, { status: 400 });
    }

    const apiKey = scalevSetting.api_key;
    const baseUrl = scalevSetting.url || 'https://api.scalev.id/v3';
    
    // Tarik data detail bundling dari Scalev
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/bundles/${bundleId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ 
        success: false, 
        message: 'Gagal menarik data isi bundling dari Scalev',
        error: data
      }, { status: response.status });
    }

    // Extract bundlelines
    const bundleLines = data.bundlelines || [];

    return NextResponse.json({ 
      success: true, 
      data: bundleLines
    }, { status: 200 });
    
  } catch (error: any) {
    console.error('API Scalev Bundles Detail Error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Terjadi kesalahan pada server saat menarik detail bundling',
      error: error.message
    }, { status: 500 });
  }
}
