import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js API Route for proxying requests to the backend.
 * Handles all requests to /api/backend/:path*
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  if (!backendUrl) {
    return NextResponse.json({ message: 'Backend URL not configured' }, { status: 500 });
  }

  // request.urlから/api/backend/以降のパスを抽出
  const urlPath = request.nextUrl.pathname;
  const proxyPath = urlPath.replace('/api/backend', ''); // /auth/login など
  if (proxyPath === '/socket-auth') {
    const cookieStore = request.cookies;
    const jwtToken = cookieStore.get('jwt')?.value;

    if (jwtToken) {
      return NextResponse.json({ token: jwtToken });
    }
    return NextResponse.json({ error: 'No JWT token found in cookies' }, { status: 401 });
  }

  const destinationUrl = `${backendUrl}/api${proxyPath}${request.nextUrl.search}`;

  try {
    const response = await fetch(destinationUrl, {
      method: 'GET',
      headers: request.headers,
    });

    const data = await response.arrayBuffer(); // レスポンスボディをArrayBufferとして取得
    const headers = new Headers(response.headers);

    // Content-Encodingヘッダーを削除して、Next.jsが自動で圧縮するようにする
    headers.delete('content-encoding');

    return new NextResponse(data, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  } catch (error) {
    console.error('Proxy GET request failed:', error);
    return NextResponse.json({ message: 'Proxy request failed' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  if (!backendUrl) {
    return NextResponse.json({ message: 'Backend URL not configured' }, { status: 500 });
  }

  // request.urlから/api/backend/以降のパスを抽出
  const urlPath = request.nextUrl.pathname;
  const proxyPath = urlPath.replace('/api/backend', ''); // /auth/login など
  const destinationUrl = `${backendUrl}/api${proxyPath}${request.nextUrl.search}`;

  try {
    const body = await request.text(); // POSTリクエストのボディを取得

    const response = await fetch(destinationUrl, {
      method: 'POST',
      headers: request.headers,
      body: body,
    });

    const data = await response.arrayBuffer(); // レスポンスボディをArrayBufferとして取得
    const headers = new Headers(response.headers);

    // Content-Encodingヘッダーを削除して、Next.jsが自動で圧縮するようにする
    headers.delete('content-encoding');

    return new NextResponse(data, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  } catch (error) {
    console.error('Proxy POST request failed:', error);
    return NextResponse.json({ message: 'Proxy request failed' }, { status: 500 });
  }
}

// 他のHTTPメソッド (PUT, DELETEなど) も必要に応じて追加
