import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';

import type { User } from '@/types';

type SessionUserRow = {
  id: number;
  name: string;
  email: string;
  role: string | null;
  permissions: string | null;
  photo_url: string | null;
};

async function hasPhotoUrlColumn() {
  const rows = await prisma.$queryRawUnsafe<Array<{ Field: string }>>("SHOW COLUMNS FROM users LIKE 'photo_url'");
  return rows.length > 0;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = Number(cookieStore.get('sahada_user_id')?.value || 0);

    if (!userId) {
      return NextResponse.json({ success: true, data: null });
    }

    const photoColumnExists = await hasPhotoUrlColumn();
    const rows = await prisma.$queryRawUnsafe<SessionUserRow[]>(
      photoColumnExists
        ? 'SELECT id, name, email, role, permissions, photo_url FROM users WHERE id = ? LIMIT 1'
        : 'SELECT id, name, email, role, permissions, NULL AS photo_url FROM users WHERE id = ? LIMIT 1',
      userId,
    );

    const user = rows[0];
    if (!user) {
      const response = NextResponse.json({ success: true, data: null });
      response.cookies.set('sahada_user_id', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
      return response;
    }

    const sessionUser: User = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: (user.role || 'cs') as User['role'],
      permissions: user.permissions ? JSON.parse(user.permissions) : [],
      photo_url: user.photo_url ?? null,
    };

    return NextResponse.json({ success: true, data: sessionUser });
  } catch (error) {
    console.error('[API /auth/session]', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memeriksa sesi login.' },
      { status: 500 },
    );
  }
}
