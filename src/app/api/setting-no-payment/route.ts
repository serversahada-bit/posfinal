import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

type NoPaymentRow = {
  id: number;
  method_name: string;
  description: string | null;
  is_active: number | boolean | null;
  no_shipping_cost: number | boolean | null;
};

const normalizeRow = (row: NoPaymentRow) => ({
  ...row,
  is_active: Boolean(row.is_active),
  no_shipping_cost: Boolean(row.no_shipping_cost),
});

export async function GET() {
  try {
    const data = await prisma.$queryRawUnsafe<NoPaymentRow[]>(
      'SELECT id, method_name, description, is_active, no_shipping_cost FROM no_payment_methods ORDER BY method_name ASC'
    );

    return NextResponse.json({ success: true, data: data.map(normalizeRow) });
  } catch (error: unknown) {
    console.error('[API /setting-no-payment GET]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal mengambil data metode no payment' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const method_name = String(body?.method_name || '').trim();
    const description = String(body?.description || '').trim();
    const is_active = Boolean(body?.is_active);
    const no_shipping_cost = Boolean(body?.no_shipping_cost);

    if (!method_name) {
      return NextResponse.json({ success: false, message: 'Nama metode wajib diisi.' }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      'INSERT INTO no_payment_methods (method_name, description, is_active, no_shipping_cost) VALUES (?, ?, ?, ?)',
      method_name,
      description || null,
      is_active ? 1 : 0,
      no_shipping_cost ? 1 : 0,
    );

    return NextResponse.json({ success: true, message: 'Metode No Payment baru berhasil ditambahkan.' });
  } catch (error: unknown) {
    console.error('[API /setting-no-payment POST]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal menambah metode no payment' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = Number(body?.id || 0);
    const method_name = String(body?.method_name || '').trim();
    const description = String(body?.description || '').trim();
    const is_active = Boolean(body?.is_active);
    const no_shipping_cost = Boolean(body?.no_shipping_cost);

    if (!id || !method_name) {
      return NextResponse.json({ success: false, message: 'ID dan nama metode wajib diisi.' }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      'UPDATE no_payment_methods SET method_name = ?, description = ?, is_active = ?, no_shipping_cost = ? WHERE id = ?',
      method_name,
      description || null,
      is_active ? 1 : 0,
      no_shipping_cost ? 1 : 0,
      id,
    );

    return NextResponse.json({ success: true, message: 'Metode No Payment berhasil diperbarui.' });
  } catch (error: unknown) {
    console.error('[API /setting-no-payment PUT]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal memperbarui metode no payment' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = Number(searchParams.get('id') || 0);

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID metode wajib diisi.' }, { status: 400 });
    }

    await prisma.$executeRawUnsafe('DELETE FROM no_payment_methods WHERE id = ?', id);

    return NextResponse.json({ success: true, message: 'Metode No Payment berhasil dihapus.' });
  } catch (error: unknown) {
    console.error('[API /setting-no-payment DELETE]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal menghapus metode no payment' }, { status: 500 });
  }
}