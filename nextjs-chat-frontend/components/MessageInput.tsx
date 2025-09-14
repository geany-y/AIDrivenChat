'use client';

import React, { FormEvent } from 'react';

interface MessageInputProps {
  newMessage: string;
  setNewMessage: (message: string) => void;
  onSendMessage: (e: FormEvent) => void;
  selectedChannel: { _id: string; name: string } | null;
  error: string;
}

/**
 * メッセージ入力コンポーネント。
 * メッセージ入力フォームと送信ボタンを提供します。
 * @param {MessageInputProps} props - コンポーネントのプロパティ
 * @returns {JSX.Element} メッセージ入力フォーム
 */
export default function MessageInput({
  newMessage,
  setNewMessage,
  onSendMessage,
  selectedChannel,
  error,
}: MessageInputProps) {
  return (
    <footer className="border-t bg-white p-4 shadow-md">
      <form onSubmit={onSendMessage} className="flex">
        <input
          type="text"
          className="flex-1 rounded-l-md border p-2 focus:border-blue-500 focus:ring focus:ring-blue-200"
          placeholder="メッセージを入力..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={!selectedChannel}
        />
        <button
          type="submit"
          className="rounded-r-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          disabled={!selectedChannel || !newMessage.trim()}
        >
          送信
        </button>
      </form>
      {error && <p className="mt-2 text-red-500">{error}</p>}
    </footer>
  );
}
