'use client';

import React, { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '../../components/SocketProvider';

interface User {
  id: string;
  username: string;
}

interface Channel {
  _id: string;
  name: string;
}

interface Message {
  _id: string;
  channelId: string;
  userId: string;
  username: string;
  content: string;
  parentId: string | null;
  timestamp: string;
}

export default function ChatPage() {
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
      router.push('/login');
    } else if (socket && !isConnected) {
      // トークンがあればソケットを接続
      socket.auth = { token };
      socket.connect();
    }
  }, [router, socket, isConnected]);

  useEffect(() => {
    if (isConnected && socket) {
      // チャンネルリストを取得
      fetchChannels();

      socket.on('receiveMessage', (message: Message) => {
        setMessages((prevMessages) => [...prevMessages, message]);
      });

      return () => {
        socket.off('receiveMessage');
      };
    }
  }, [isConnected, socket]);

  useEffect(() => {
    if (selectedChannel) {
      fetchMessages(selectedChannel._id);
      if (socket && isConnected) {
        socket.emit('joinChannel', selectedChannel._id);
      }
    }
  }, [selectedChannel, socket, isConnected]);

  const fetchChannels = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/channels`);
      if (!response.ok) {
        throw new Error('Failed to fetch channels');
      }
      const data = await response.json();
      setChannels(data);
      if (data.length > 0 && !selectedChannel) {
        setSelectedChannel(data[0]); // デフォルトで最初のチャンネルを選択
      }
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

  const fetchMessages = async (channelId: string) => {
    try {
      const token = localStorage.getItem('jwtToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/channels/${channelId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      const data = await response.json();
      setMessages(data);
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

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (socket && isConnected && selectedChannel && newMessage.trim()) {
      socket.emit('sendMessage', { channelId: selectedChannel._id, content: newMessage });
      setNewMessage('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwtToken');
    if (socket) {
      socket.disconnect();
    }
    router.push('/login');
  };

  if (!isConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p>Connecting to chat server...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* サイドバー (チャンネルリスト) */}
      <div className="w-64 border-r bg-white p-4 shadow-md">
        <h2 className="mb-4 text-xl font-bold">チャンネル</h2>
        <ul>
          {channels.map((channel) => (
            <li
              key={channel._id}
              className={`mb-2 cursor-pointer rounded-md p-2 hover:bg-blue-100 ${
                selectedChannel?._id === channel._id ? 'bg-blue-200' : ''
              }`}
              onClick={() => setSelectedChannel(channel)}
            >
              #{channel.name}
            </li>
          ))}
        </ul>
        <button
          onClick={handleLogout}
          className="mt-4 w-full rounded-md bg-red-500 py-2 text-white hover:bg-red-600"
        >
          ログアウト
        </button>
      </div>

      {/* メインチャットエリア */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-white p-4 shadow-md">
          <h1 className="text-xl font-bold">
            {selectedChannel ? `#${selectedChannel.name}` : 'チャンネルを選択'}
          </h1>
          {/* オンラインユーザー表示など、将来的に追加 */}
        </header>

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

        <footer className="border-t bg-white p-4 shadow-md">
          <form onSubmit={handleSendMessage} className="flex">
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
      </div>
    </div>
  );
}
