import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { users_role } from '@prisma/client';
import { deleteStoredUpload, saveUploadBuffer } from '@/lib/uploadStorage';

type UserPayload = {
  id?: number;
  name: string;
  email: string;
  password?: string;
  role: users_role;
  permissions?: string[];
  existing_photo_url?: string | null;
};

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: users_role | null;
  permissions: string | null;
  photo_url: string | null;
  created_at: Date;
  updated_at: Date;
};

const parsePermissions = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  return [];
};

const serializeUser = (user: UserRow) => ({
  ...user,
  role: (user.role ?? 'admin') as users_role,
  permissions: user.permissions ? JSON.parse(user.permissions) : [],
  photo_url: user.photo_url ?? null,
});

const removeStoredFile = async (storedUrl: string | null | undefined) => {
  if (!storedUrl) return;

  try {
    await deleteStoredUpload(storedUrl);
  } catch (error) {
    console.error('Failed to delete user photo', error);
  }
};

async function hasPhotoUrlColumn() {
  const rows = await prisma.$queryRawUnsafe<Array<{ Field: string }>>("SHOW COLUMNS FROM users LIKE 'photo_url'");
  return rows.length > 0;
}

async function uploadPhoto(file: File | null, existingUrl: string | null = null): Promise<string | null> {
  if (!file || typeof file === 'string' || file.size === 0) {
    return existingUrl;
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
  if (!allowedExts.includes(ext)) {
    throw new Error('Foto profil harus berupa JPG, JPEG, PNG, atau WEBP.');
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  const stored = await saveUploadBuffer(['users'], filename, buffer);
  await removeStoredFile(existingUrl);

  return stored.url;
}

const parseRequestBody = async (request: NextRequest): Promise<{ body: UserPayload; file: File | null }> => {
  if (request.headers.get('content-type')?.includes('multipart/form-data')) {
    const formData = await request.formData();
    return {
      body: {
        id: formData.get('id') ? Number(formData.get('id')) : undefined,
        name: String(formData.get('name') || '').trim(),
        email: String(formData.get('email') || '').trim(),
        password: String(formData.get('password') || ''),
        role: String(formData.get('role') || 'cs') as users_role,
        permissions: parsePermissions(formData.get('permissions')),
        existing_photo_url: String(formData.get('existing_photo_url') || '') || null,
      },
      file: formData.get('photo') as File | null,
    };
  }

  const json = await request.json() as UserPayload;
  return {
    body: {
      ...json,
      id: json.id ? Number(json.id) : undefined,
      name: String(json.name || '').trim(),
      email: String(json.email || '').trim(),
      password: String(json.password || ''),
      permissions: parsePermissions(json.permissions),
      existing_photo_url: json.existing_photo_url || null,
    },
    file: null,
  };
};

const findUserByEmail = async (email: string) => {
  const photoColumnExists = await hasPhotoUrlColumn();
  const rows = await prisma.$queryRawUnsafe<UserRow[]>(
    photoColumnExists
      ? 'SELECT id, name, email, role, permissions, photo_url, created_at, updated_at FROM users WHERE email = ? LIMIT 1'
      : 'SELECT id, name, email, role, permissions, NULL AS photo_url, created_at, updated_at FROM users WHERE email = ? LIMIT 1',
    email,
  );
  return rows[0] || null;
};

const findUserById = async (id: number) => {
  const photoColumnExists = await hasPhotoUrlColumn();
  const rows = await prisma.$queryRawUnsafe<UserRow[]>(
    photoColumnExists
      ? 'SELECT id, name, email, role, permissions, photo_url, created_at, updated_at FROM users WHERE id = ? LIMIT 1'
      : 'SELECT id, name, email, role, permissions, NULL AS photo_url, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
    id,
  );
  return rows[0] || null;
};

export async function GET() {
  try {
    const photoColumnExists = await hasPhotoUrlColumn();
    const users = await prisma.$queryRawUnsafe<UserRow[]>(
      photoColumnExists
        ? 'SELECT id, name, email, role, permissions, photo_url, created_at, updated_at FROM users ORDER BY id DESC'
        : 'SELECT id, name, email, role, permissions, NULL AS photo_url, created_at, updated_at FROM users ORDER BY id DESC'
    );

    return Response.json({
      success: true,
      data: users.map(serializeUser),
    });
  } catch (error) {
    console.error('[API /users GET]', error);
    return Response.json({ success: false, message: 'Gagal mengambil data user' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { body, file } = await parseRequestBody(request);
    const { name, email, password, role, permissions } = body;

    if (!name || !email || !password || !role) {
      return Response.json({ success: false, message: 'Nama, email, password, dan role wajib diisi' }, { status: 400 });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return Response.json({ success: false, message: 'Email/Username sudah digunakan.' }, { status: 400 });
    }

    const photoColumnExists = await hasPhotoUrlColumn();
    const photoUrl = photoColumnExists ? await uploadPhoto(file) : null;

    if (photoColumnExists) {
      await prisma.$executeRawUnsafe(
        'INSERT INTO users (name, email, password, role, permissions, photo_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
        name,
        email,
        password,
        role,
        permissions?.length ? JSON.stringify(permissions) : null,
        photoUrl,
      );
    } else {
      await prisma.$executeRawUnsafe(
        'INSERT INTO users (name, email, password, role, permissions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        name,
        email,
        password,
        role,
        permissions?.length ? JSON.stringify(permissions) : null,
      );
    }

    const createdUser = await findUserByEmail(email);
    return Response.json({ success: true, message: 'User berhasil ditambahkan', data: createdUser ? serializeUser(createdUser) : null });
  } catch (error) {
    console.error('[API /users POST]', error);
    return Response.json({ success: false, message: error instanceof Error ? error.message : 'Gagal menambah user.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { body, file } = await parseRequestBody(request);
    const { id, name, email, password, role, permissions, existing_photo_url } = body;

    if (!id || !name || !email || !role) {
      return Response.json({ success: false, message: 'ID, nama, email, dan role wajib diisi' }, { status: 400 });
    }

    const duplicate = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      'SELECT COUNT(*) AS total FROM users WHERE email = ? AND id != ?',
      email,
      Number(id),
    );

    if (Number(duplicate[0]?.total || 0) > 0) {
      return Response.json({ success: false, message: 'Email/Username sudah digunakan oleh akun lain.' }, { status: 400 });
    }

    const photoColumnExists = await hasPhotoUrlColumn();
    let photoUrl = existing_photo_url || null;
    if (photoColumnExists && file && file.size > 0) {
      photoUrl = await uploadPhoto(file, existing_photo_url);
    }

    const nextPassword = password ? password : null;
    if (photoColumnExists) {
      await prisma.$executeRawUnsafe(
        'UPDATE users SET name = ?, email = ?, password = COALESCE(?, password), role = ?, permissions = ?, photo_url = ?, updated_at = NOW() WHERE id = ?',
        name,
        email,
        nextPassword,
        role,
        permissions?.length ? JSON.stringify(permissions) : null,
        photoUrl,
        Number(id),
      );
    } else {
      await prisma.$executeRawUnsafe(
        'UPDATE users SET name = ?, email = ?, password = COALESCE(?, password), role = ?, permissions = ?, updated_at = NOW() WHERE id = ?',
        name,
        email,
        nextPassword,
        role,
        permissions?.length ? JSON.stringify(permissions) : null,
        Number(id),
      );
    }

    const updatedUser = await findUserById(Number(id));
    return Response.json({ success: true, message: 'User berhasil diperbarui', data: updatedUser ? serializeUser(updatedUser) : null });
  } catch (error) {
    console.error('[API /users PUT]', error);
    return Response.json({ success: false, message: error instanceof Error ? error.message : 'Gagal memperbarui user' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ success: false, message: 'ID user wajib diisi' }, { status: 400 });
    }

    const user = await findUserById(Number(id));
    await removeStoredFile(user?.photo_url);
    await prisma.$executeRawUnsafe('DELETE FROM users WHERE id = ?', Number(id));

    return Response.json({ success: true, message: 'User berhasil dihapus' });
  } catch (error) {
    console.error('[API /users DELETE]', error);
    return Response.json({ success: false, message: 'Gagal menghapus user' }, { status: 500 });
  }
}
