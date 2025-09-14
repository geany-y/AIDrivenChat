import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers'; // Next.js 13.4以降で利用可能

/**
 * GETリクエストを処理するAPIルート。
 * バックエンドへのプロキシとして機能し、特定の`endpoint`に応じてCookieからJWTトークンを返します。
 * @param {NextRequest} request - Next.jsリクエストオブジェクト
 * @returns {Promise<NextResponse>} レスポンスオブジェクト
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');

  if (endpoint === 'socket-auth') {
    // Socket.io認証用のJWTトークンをCookieから取得
    const cookieStore = cookies();
    const jwtToken = cookieStore.get('jwt')?.value;

    if (jwtToken) {
      return NextResponse.json({ token: jwtToken });
    } else {
      return NextResponse.json({ error: 'No JWT token found in cookies' }, { status: 401 });
    }
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/${endpoint}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods':
          'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error(error); // console.logからconsole.errorに変更
    return NextResponse.json(
      { error: 'API エラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * DELETEリクエストを処理するAPIルート。
 * 特定の`endpoint`に応じてCookieをクリアします。
 * @param {NextRequest} request - Next.jsリクエストオブジェクト
 * @returns {Promise<NextResponse>} レスポンスオブジェクト
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');

  if (endpoint === 'auth/logout') {
    const response = NextResponse.json({ message: 'Logout successful' });
    response.cookies.set('jwt', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0 });
    return response;
  }

  return NextResponse.json({ error: 'Invalid endpoint for DELETE request' }, { status: 400 });
}

/**
 * POSTリクエストを処理するAPIルート。
 * バックエンドへのプロキシとして機能します。
 * @param {NextRequest} request - Next.jsリクエストオブジェクト
 * @returns {Promise<NextResponse>} レスポンスオブジェクト
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { searchParams } = new URL(request.url); // endpointを取得するために追加
  const endpoint = searchParams.get('endpoint'); // endpointを取得するために追加

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/${endpoint}`, // endpointを使用するように修正
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods':
          'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error(error); // console.logからconsole.errorに変更
    return NextResponse.json(
      { error: 'API エラーが発生しました' },
      { status: 500 }
    );
  }
}
