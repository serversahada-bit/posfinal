import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { landingPageId, customDomain } = body;

    if (!landingPageId || !customDomain) {
      return NextResponse.json({ error: 'Landing Page ID dan Custom Domain wajib diisi' }, { status: 400 });
    }

    if (!CF_API_TOKEN || !CF_ZONE_ID) {
      return NextResponse.json({ error: 'Konfigurasi Cloudflare belum diatur di server (.env)' }, { status: 500 });
    }

    // Call Cloudflare API to create Custom Hostname
    const cfResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hostname: customDomain,
        ssl: {
          method: 'txt',
          type: 'dv'
        }
      })
    });

    const cfData = await cfResponse.json();

    if (!cfData.success) {
      console.error('Cloudflare Error:', cfData.errors);
      return NextResponse.json({ error: 'Gagal mendaftarkan domain ke Cloudflare', details: cfData.errors }, { status: 400 });
    }

    const hostnameId = cfData.result.id;
    const ownershipName = cfData.result.ownership_verification?.name;
    const ownershipValue = cfData.result.ownership_verification?.value;
    const sslName = cfData.result.ssl?.txt_name;
    const sslValue = cfData.result.ssl?.txt_value;

    // Save to DB
    const updatedLp = await prisma.landing_pages.update({
      where: { id: parseInt(landingPageId) },
      data: {
        domain: customDomain,
        domain_status: 'pending',
        cf_hostname_id: hostnameId,
        cf_ownership_name: ownershipName,
        cf_ownership_value: ownershipValue,
        cf_ssl_name: sslName,
        cf_ssl_value: sslValue,
      }
    });

    return NextResponse.json({
      message: 'Custom domain berhasil didaftarkan',
      data: updatedLp
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const hostnameId = searchParams.get('id');
    const lpId = searchParams.get('lpId');

    if (!hostnameId || !lpId) {
      return NextResponse.json({ error: 'Hostname ID dan LP ID wajib disertakan' }, { status: 400 });
    }

    if (!CF_API_TOKEN || !CF_ZONE_ID) {
      return NextResponse.json({ error: 'Konfigurasi Cloudflare belum diatur' }, { status: 500 });
    }

    // Check status in Cloudflare
    const cfResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames/${hostnameId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      }
    });

    const cfData = await cfResponse.json();

    if (!cfData.success) {
      return NextResponse.json({ error: 'Gagal mengecek status ke Cloudflare', details: cfData.errors }, { status: 400 });
    }

    const status = cfData.result.status; // 'active', 'pending', etc.
    const sslStatus = cfData.result.ssl?.status; // 'active', 'pending_validation', etc.

    // If active, update DB
    if (status === 'active' && sslStatus === 'active') {
      await prisma.landing_pages.update({
        where: { id: parseInt(lpId) },
        data: { domain_status: 'active' }
      });
    }

    return NextResponse.json({
      message: 'Status berhasil diambil',
      data: { status, sslStatus }
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const hostnameId = searchParams.get('id');
    const lpId = searchParams.get('lpId');

    if (!lpId) {
      return NextResponse.json({ error: 'LP ID wajib disertakan' }, { status: 400 });
    }

    // If hostnameId exists, delete from CF
    if (hostnameId && CF_API_TOKEN && CF_ZONE_ID) {
      await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames/${hostnameId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        }
      });
    }

    // Remove from DB
    await prisma.landing_pages.update({
      where: { id: parseInt(lpId) },
      data: {
        domain: null,
        domain_status: 'inactive',
        cf_hostname_id: null,
        cf_ownership_name: null,
        cf_ownership_value: null,
        cf_ssl_name: null,
        cf_ssl_value: null,
      }
    });

    return NextResponse.json({ message: 'Custom domain berhasil dihapus' });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
