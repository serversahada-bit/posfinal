import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { customers_status } from '@prisma/client';

// GET /api/customers — setara data_kostumer.php POIN
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') ?? '';
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limit = 20;
    const offset = (page - 1) * limit;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { whatsapp_number: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const customers = await prisma.customers.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      take: limit,
      skip: offset,
    });

    return Response.json({ success: true, data: customers });
  } catch (error) {
    console.error('[API /customers GET]', error);
    return Response.json({ success: false, message: 'Gagal mengambil data pelanggan' }, { status: 500 });
  }
}

// POST /api/customers — tambah pelanggan baru
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, whatsapp_number, email } = body as {
      name: string;
      whatsapp_number?: string;
      email?: string;
    };

    if (!name) {
      return Response.json({ success: false, message: 'Nama pelanggan wajib diisi' }, { status: 400 });
    }

    const customer = await prisma.customers.create({
      data: {
        name,
        whatsapp_number: whatsapp_number || null,
        email: email || null,
        status: 'active',
      },
    });

    return Response.json({
      success: true,
      message: 'Pelanggan berhasil ditambahkan',
      data: { id: customer.id },
    });
  } catch (error) {
    console.error('[API /customers POST]', error);
    return Response.json({ success: false, message: 'Gagal menambah pelanggan' }, { status: 500 });
  }
}
