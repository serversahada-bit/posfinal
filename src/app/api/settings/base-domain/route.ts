import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const settings: any[] = await prisma.$queryRaw`SELECT value FROM global_settings WHERE \`key\` = 'base_domain' LIMIT 1`;
    return NextResponse.json({ status: 'success', data: settings.length > 0 ? settings[0].value : '' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { domain } = body;

    const existing: any[] = await prisma.$queryRaw`SELECT id FROM global_settings WHERE \`key\` = 'base_domain' LIMIT 1`;
    if (existing.length > 0) {
      await prisma.$executeRaw`UPDATE global_settings SET value = ${domain} WHERE \`key\` = 'base_domain'`;
    } else {
      await prisma.$executeRaw`INSERT INTO global_settings (\`key\`, value) VALUES ('base_domain', ${domain})`;
    }

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
