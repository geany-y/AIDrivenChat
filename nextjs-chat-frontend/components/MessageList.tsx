'use client';

import React from 'react';

interface Message {
  _id: string;
  channelId: string;
  userId: string;
  username: string;
  content: string;
  parentId: string | null;
  timestamp: string;
}

interface MessageListProps {
  messages: Message[];
}

/**
 * メッセージリストコンポーネント。
 * チャットメッセージの一覧を表示します。
 * @param {MessageListProps} props - コンポーネントのプロパティ
 * @returns {JSX.Element} メッセージリスト
 */
export default function MessageList({ messages }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.map((message) => (
        <div key={message._id} className="mb-4 rounded-lg bg-white p-3 shadow-sm">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-blue-600">{message.username}</span>
            <span className="text-xs text-gray-500">
              {new Date(message.timestamp).toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-gray-800">{message.content}</p>
          {/* スレッド表示は将来的に追加 */}
        </div>
      ))}
    </div>
  );
}
