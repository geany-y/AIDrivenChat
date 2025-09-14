'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * ログインページコンポーネント。
 * ユーザー名とパスワードを入力してログインします。
 * @returns {JSX.Element} ログインページ
 */
export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  /**
   * ログイン処理ハンドラ。
   * ユーザー名とパスワードをバックエンドに送信し、認証を行います。
   * 成功した場合、チャットページへリダイレクトします。
   * @param {React.FormEvent} e - フォームイベントオブジェクト
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // TODO: ユーザー入力のバリデーションとサニタイズを強化
      const response = await fetch('/api?endpoint=auth/login', { // Next.js API Route経由でバックエンドにアクセス
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Login failed');
      }

      // バックエンドがHTTP Only Cookieを設定するため、フロントエンドでトークンを保存する必要はない
      // const data = await response.json(); // レスポンスボディにトークンは含まれない
      // localStorage.setItem('jwtToken', data.token); // 削除

      router.push('/chat'); // ログイン成功後、チャットページへリダイレクト
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        setError((err as { message: string }).message);
      } else {
        setError('An unknown error occurred');
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold">ログイン</h1>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label htmlFor="username" className="mb-2 block text-sm font-medium text-gray-700">
              ユーザー名
            </label>
            <input
              type="text"
              id="username"
              className="w-full rounded-md border p-2 focus:border-blue-500 focus:ring focus:ring-blue-200"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
              パスワード
            </label>
            <input
              type="password"
              id="password"
              className="w-full rounded-md border p-2 focus:border-blue-500 focus:ring focus:ring-blue-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="mb-4 text-center text-red-500">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-md bg-blue-500 py-2 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            ログイン
          </button>
        </form>
      </div>
    </div>
  );
}
