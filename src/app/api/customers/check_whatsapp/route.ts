import { NextResponse } from 'next/server';
import { findRemoteCustomerByWhatsapp } from '@/lib/remote-customer-db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let wa = searchParams.get('wa') || '';
  wa = wa.replace(/[^0-9]/g, '');

  if (wa.length < 10) {
    return NextResponse.json({ status: 'error', message: 'Nomor WA terlalu pendek' }, { status: 400 });
  }

  try {
    const customer = await findRemoteCustomerByWhatsapp(wa);

    if (customer) {
      const createdDate = customer.registered_at ? new Date(customer.registered_at) : new Date();
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - createdDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return NextResponse.json({
        status: 'success',
        data: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          address: customer.address,
          subdistrict: customer.subdistrict,
          whatsapp_number: customer.whatsapp_number,
          desa: customer.desa,
          city: customer.city,
          province: customer.province,
        },
        days_since_created: diffDays,
      });
    } else {
      return NextResponse.json({ status: 'not_found', message: 'Nomor belum terdaftar.' });
    }
  } catch (error: any) {
    console.error('Error checking whatsapp:', error);
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan internal server' },
      { status: 500 }
    );
  }
}
