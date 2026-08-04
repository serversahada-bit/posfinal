import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Terjadi kesalahan');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = 50;
    const offset = (page - 1) * limit;
    const search = String(searchParams.get('search') || '').trim();

    const whereClause: Prisma.activity_logsWhereInput = search
      ? {
          OR: [
            { action: { contains: search } },
            { target: { contains: search } },
            { details: { contains: search } },
            { users: { name: { contains: search } } },
          ],
        }
      : {};

    const [totalRows, logs] = await Promise.all([
      prisma.activity_logs.count({
        where: whereClause,
      }),
      prisma.activity_logs.findMany({
        where: whereClause,
        include: {
          users: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          id: 'desc',
        },
        skip: offset,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalRows / limit));

    return NextResponse.json({
      success: true,
      data: {
        logs: logs.map((row) => ({
          id: row.id,
          action: row.action,
          target: row.target,
          details: row.details,
          ip_address: row.ip_address,
          created_at: row.created_at,
          user_name: row.users?.name ?? null,
        })),
        pagination: {
          page,
          limit,
          totalRows,
          totalPages,
        },
      },
    });
  } catch (error: unknown) {
    console.error('[API /logs GET]', error);
    return NextResponse.json({ success: false, message: getErrorMessage(error) || 'Gagal mengambil data log aktivitas' }, { status: 500 });
  }
}
