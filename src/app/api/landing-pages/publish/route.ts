import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { publishLandingPageBundle } from '@/lib/landing-page-publisher';
import { Block } from '@/lib/landing-page-renderer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, slug, blocks_json, domain, domain_status } = body;

    if (!slug || !blocks_json) {
      return NextResponse.json(
        { error: 'Slug dan blocks_json wajib diisi.' },
        { status: 400 }
      );
    }

    let blocks: Block[];

    try {
      blocks = typeof blocks_json === 'string' ? JSON.parse(blocks_json) : blocks_json;
    } catch {
      return NextResponse.json(
        { error: 'Format blocks_json tidak valid.' },
        { status: 400 }
      );
    }

    const publishResult = await publishLandingPageBundle({
      title: title || 'Tanpa Judul',
      slug,
      blocks,
    });

    const landingPage = await prisma.landing_pages.upsert({
      where: { slug: publishResult.slug },
      update: {
        title: title || 'Tanpa Judul',
        html_data: publishResult.htmlData,
        blocks_json: JSON.stringify(blocks),
        status: 'Published',
        domain: domain || null,
        domain_status: domain ? domain_status || 'pending' : 'inactive',
        updated_at: new Date(),
      },
      create: {
        title: title || 'Tanpa Judul',
        slug: publishResult.slug,
        html_data: publishResult.htmlData,
        blocks_json: JSON.stringify(blocks),
        status: 'Published',
        domain: domain || null,
        domain_status: domain ? domain_status || 'pending' : 'inactive',
      },
    });

    return NextResponse.json(
      {
        message: 'Landing page berhasil dipublish.',
        data: landingPage,
        publish: {
          output_dir: publishResult.outputDir,
          exported_files: publishResult.exportedFiles,
          deploy_status: publishResult.deployStatus,
          deploy_message: publishResult.deployMessage,
          remote_path: publishResult.remotePath,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error publishing landing page:', error);
    return NextResponse.json(
      { error: 'Gagal publish landing page', details },
      { status: 500 }
    );
  }
}
