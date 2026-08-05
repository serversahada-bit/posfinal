import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { searchRemoteCustomers } from '@/lib/remote-customer-db';

export const dynamic = 'force-dynamic';

type LocalOrderResult = {
  id: number;
  first_name: string | null;
  contact: string | null;
  email: string | null;
  alamat: string | null;
  desa: string | null;
  kecamatan: string | null;
  kota_kabupaten: string | null;
  provinsi: string | null;
  unique_code: string | null;
  scalev_order_id: string | null;
  created_at: Date | string | null;
};

type CustomerSearchResult = {
  id: number;
  text: string;
  name: string;
  whatsapp_number: string;
  email: string;
  address: string;
  subdistrict: string;
  desa: string;
  city: string;
  province: string;
  registered_at: Date | null;
};

const normalizeRegisteredAt = (value: Date | string | null) => {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  try {
    let results = await searchRemoteCustomers(q);

    if (q.length >= 2) {
      const like = `%${q}%`;

      const [localOrders, localCustomers] = await Promise.all([
        prisma.$queryRawUnsafe<LocalOrderResult[]>(
          `
            SELECT
              id,
              first_name,
              contact,
              email,
              alamat,
              desa,
              kecamatan,
              kota_kabupaten,
              provinsi,
              unique_code,
              scalev_order_id,
              created_at
            FROM orders
            WHERE unique_code LIKE ?
              OR COALESCE(scalev_order_id, '') LIKE ?
              OR first_name LIKE ?
              OR contact LIKE ?
            ORDER BY id DESC
            LIMIT 5
          `,
          like,
          like,
          like,
          like,
        ),
        prisma.customers.findMany({
          where: {
            OR: [
              { name: { contains: q } },
              { whatsapp_number: { contains: q } },
            ],
          },
          take: 5,
          orderBy: { id: 'desc' },
        }),
      ]);

      const localResults: CustomerSearchResult[] = [];
      const seenKeys = new Set<string>();

      const addLocalResult = (payload: CustomerSearchResult) => {
        const key = `${payload.name}|${payload.whatsapp_number}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
        localResults.push(payload);
      };

      localOrders.forEach((order) => {
        addLocalResult({
          id: order.id,
          text: `${order.first_name || 'Tanpa Nama'} - ${order.contact || 'No WA'} (Order: ${order.unique_code || '-'})`,
          name: order.first_name || '',
          whatsapp_number: order.contact || '',
          email: order.email || '',
          address: order.alamat || '',
          subdistrict: [order.provinsi, order.kota_kabupaten, order.kecamatan].filter(Boolean).join(', '),
          desa: order.desa || '',
          city: order.kota_kabupaten || '',
          province: order.provinsi || '',
          registered_at: normalizeRegisteredAt(order.created_at),
        });
      });

      localCustomers.forEach((customer) => {
        addLocalResult({
          id: customer.id,
          text: `${customer.name || 'Tanpa Nama'} - ${customer.whatsapp_number || 'No WA'} (Local)`,
          name: customer.name || '',
          whatsapp_number: customer.whatsapp_number || '',
          email: customer.email || '',
          address: customer.address || '',
          subdistrict: customer.subdistrict || '',
          desa: customer.desa || '',
          city: customer.city || '',
          province: customer.province || '',
          registered_at: normalizeRegisteredAt(customer.created_at),
        });
      });

      if (localResults.length > 0) {
        results = [...localResults, ...results];
      }
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error searching customers:', error);
    return NextResponse.json(
      { error: 'Failed to search customers', details: message },
      { status: 500 },
    );
  }
}
