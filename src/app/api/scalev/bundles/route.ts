import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
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
    
    let allBundles: any[] = [];
    let hasNext = true;
    let nextCursor: string | null = null;
    let pageCount = 0;
    const MAX_PAGES = 20; // limit to prevent infinite loops (max 500 bundles)

    while (hasNext && pageCount < MAX_PAGES) {
      pageCount++;
      const url: string = nextCursor 
        ? `${baseUrl.replace(/\/+$/, '')}/bundles?next_cursor=${encodeURIComponent(nextCursor)}`
        : `${baseUrl.replace(/\/+$/, '')}/bundles`;
      
      console.log(`[Bundles API] Fetching page ${pageCount}:`, url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        cache: 'no-store'
      });

      const data = await response.json();

      if (!response.ok) {
        if (pageCount === 1) {
          // Error on first page
          return NextResponse.json({ 
            success: false, 
            message: 'Gagal menarik data bundling dari Scalev',
            error: data
          }, { status: response.status });
        } else {
          // If error on subsequent pages, just stop and return what we have
          break;
        }
      }

      const items = data.data || [];
      allBundles = [...allBundles, ...items];
      
      hasNext = data.has_next === true;
      nextCursor = data.next_cursor || null;
    }

    // Deduplicate bundles by ID just in case the pagination returns overlapping items
    const uniqueBundles = Array.from(new Map(allBundles.map(item => [item.id, item])).values());

    return NextResponse.json({ 
      success: true, 
      data: uniqueBundles
    }, { status: 200 });
    
  } catch (error: any) {
    console.error('API Scalev Bundles Error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Terjadi kesalahan pada server saat menarik data bundling',
      error: error.message
    }, { status: 500 });
  }
}
