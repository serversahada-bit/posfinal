import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

    if (!search || search.length < 3) {
      return NextResponse.json({ success: false, message: 'Minimal 3 karakter untuk pencarian.' }, { status: 400 });
    }

    const apiKey = process.env.SCALEV_API_KEY || 'sk_TEwo96ZweoJUB5RiA31j8m1WjlDk4T9Iq9Xtn7iXBwTAVDOuzlrBisOeIK307fSK';
    const baseUrl = 'https://api.scalev.id/v3';

    const res = await fetch(`${baseUrl}/locations?search=${encodeURIComponent(search)}&page_size=15`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, message: `Gagal mengambil data lokasi (HTTP ${res.status})`, details: errData },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Format ke list sederhana: { id, label }
    const locations = (data.data || []).map((loc: any) => ({
      id: loc.id,
      label: loc.display || `${loc.subdistrict_name}, ${loc.city_name}, ${loc.province_name}`,
      subdistrict: loc.subdistrict_name,
      city: loc.city_name,
      province: loc.province_name,
    }));

    return NextResponse.json({ success: true, data: locations });
  } catch (error: any) {
    console.error('[API /scalev/locations]', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan: ' + error.message },
      { status: 500 }
    );
  }
}
