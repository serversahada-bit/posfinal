import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, slug, html_data, blocks_json, status, domain, domain_status } = body;

    if (!slug || !html_data) {
      return NextResponse.json(
        { error: 'Slug dan HTML Data wajib diisi' },
        { status: 400 }
      );
    }

    const landingPage = await prisma.landing_pages.upsert({
      where: { slug: slug },
      update: {
        title: title || 'Tanpa Judul',
        html_data: html_data,
        blocks_json: blocks_json || null,
        status: status || 'Draft',
        domain: domain || null,
        domain_status: domain ? (domain_status || 'pending') : 'inactive',
        updated_at: new Date(),
      },
      create: {
        title: title || 'Tanpa Judul',
        slug: slug,
        html_data: html_data,
        blocks_json: blocks_json || null,
        status: status || 'Draft',
        domain: domain || null,
        domain_status: domain ? 'pending' : 'inactive',
      },
    });

    return NextResponse.json(
      { message: 'Landing page berhasil disimpan', data: landingPage },
      { status: 200 }
    );
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error saving landing page:', error);
    return NextResponse.json(
      { error: 'Gagal menyimpan landing page', details },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const landingPages = await prisma.landing_pages.findMany({
      orderBy: { updated_at: 'desc' }
    });
    return NextResponse.json({ data: landingPages }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error fetching landing pages:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data landing page' },
      { status: 500 }
    );
  }
}
