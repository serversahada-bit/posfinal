import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

type LoginUserRow = {
  id: number;
  name: string;
  email: string;
  password: string;
  role: string | null;
  permissions: string | null;
  photo_url: string | null;
};

async function hasPhotoUrlColumn() {
  const rows = await prisma.$queryRawUnsafe<Array<{ Field: string }>>("SHOW COLUMNS FROM users LIKE 'photo_url'");
  return rows.length > 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawUsername = body?.username ?? body?.email;
    const rawPassword = body?.password;

    const username = typeof rawUsername === 'string' ? rawUsername.trim() : '';
    const password = typeof rawPassword === 'string' ? rawPassword : '';

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Username dan password wajib diisi' },
        { status: 400 }
      );
    }

    const photoColumnExists = await hasPhotoUrlColumn();
    const rows = await prisma.$queryRawUnsafe<LoginUserRow[]>(
      photoColumnExists
        ? 'SELECT id, name, email, password, role, permissions, photo_url FROM users WHERE email = ? LIMIT 1'
        : 'SELECT id, name, email, password, role, permissions, NULL AS photo_url FROM users WHERE email = ? LIMIT 1',
      username,
    );

    const user = rows[0];

    if (!user || user.password !== password) {
      return NextResponse.json(
        { success: false, message: 'Username atau password salah!' },
        { status: 401 }
      );
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions ? JSON.parse(user.permissions) : [],
      photo_url: user.photo_url ?? null,
    };

    const response = NextResponse.json({ success: true, data: sessionUser });
    response.cookies.set('sahada_user_id', String(user.id), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error('[API /auth/login]', {
      error,
      databaseUrlExists: Boolean(process.env.DATABASE_URL),
    });

    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server. Periksa koneksi database aplikasi.' },
      { status: 500 }
    );
  }
}