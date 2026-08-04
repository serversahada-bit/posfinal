import { NextRequest, NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2/promise';
import { getMysqlPool } from '@/lib/mysql';

export const dynamic = 'force-dynamic';

type ExistsRow = RowDataPacket & {
  id: number;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const checkIdReff = searchParams.get('check_id_reff');

    if (!checkIdReff) {
      return NextResponse.json({ exists: false });
    }

    const pool = getMysqlPool();
    const [rows] = await pool.query<ExistsRow[]>(
      `
        SELECT id FROM payments WHERE fat_proof_url = ? LIMIT 1
        UNION ALL
        SELECT id FROM payments_cso WHERE fat_proof_url = ? LIMIT 1
        UNION ALL
        SELECT id FROM payments_crm WHERE fat_proof_url = ? LIMIT 1
        UNION ALL
        SELECT id FROM payments_resend WHERE fat_proof_url = ? LIMIT 1
        LIMIT 1
      `,
      [checkIdReff, checkIdReff, checkIdReff, checkIdReff],
    );

    return NextResponse.json({ exists: rows.length > 0 });
  } catch (error: unknown) {
    console.error('Error checking id_reff:', error);
    return NextResponse.json(
      { exists: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
