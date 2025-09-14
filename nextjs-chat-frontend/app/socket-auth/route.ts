import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';

/**
 * Socket.io認証用のJWTトークンをHTTP Only Cookieから取得して返すAPIルート。
 * @param {NextRequest} request - Next.jsリクエストオブジェクト
 * @returns {NextResponse} レスポンスオブジェクト
 */
export async function GET(request: NextRequest) {
  const cookieStore = request.cookies; // request.cookies から取得
  const jwtToken = cookieStore.get('jwt')?.value;

  if (jwtToken) {
    return NextResponse.json({ token: jwtToken });
  }
  return NextResponse.json({ error: 'No JWT token found in cookies' }, { status: 401 });
}
