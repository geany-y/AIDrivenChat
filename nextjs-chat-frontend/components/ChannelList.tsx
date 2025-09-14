'use client';

import React from 'react';

interface Channel {
  _id: string;
  name: string;
}

interface ChannelListProps {
  channels: Channel[];
  selectedChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onLogout: () => void;
}

/**
 * チャンネルリストコンポーネント。
 * サイドバーにチャンネル一覧とログアウトボタンを表示します。
 * @param {ChannelListProps} props - コンポーネントのプロパティ
 * @returns {JSX.Element} チャンネルリスト
 */
export default function ChannelList({
  channels,
  selectedChannel,
  onSelectChannel,
  onLogout,
}: ChannelListProps) {
  return (
    <div className="w-64 border-r bg-white p-4 shadow-md">
      <h2 className="mb-4 text-xl font-bold">チャンネル</h2>
      <ul>
        {channels.map((channel) => (
          <li
            key={channel._id}
            className={`mb-2 cursor-pointer rounded-md p-2 hover:bg-blue-100 ${
              selectedChannel?._id === channel._id ? 'bg-blue-200' : ''
            }`}
            onClick={() => onSelectChannel(channel)}
          >
            #{channel.name}
          </li>
        ))}
      </ul>
      <button
        onClick={onLogout}
        className="mt-4 w-full rounded-md bg-red-500 py-2 text-white hover:bg-red-600"
      >
        ログアウト
      </button>
    </div>
  );
}
