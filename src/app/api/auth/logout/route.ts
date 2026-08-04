import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('sahada_user_id', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
