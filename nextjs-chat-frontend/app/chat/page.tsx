'use client';

import React, { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '../../components/SocketProvider';
import ChannelList from '../../components/ChannelList'; // 追加
import MessageList from '../../components/MessageList'; // 追加
import MessageInput from '../../components/MessageInput'; // 追加

/**
 * ユーザーインターフェース。
 * @typedef {Object} User
 * @property {string} id - ユーザーID
 * @property {string} username - ユーザー名
 */
interface User {
  id: string;
  username: string;
}

/**
 * チャンネルインターフェース。
 * @typedef {Object} Channel
 * @property {string} _id - チャンネルID
 * @property {string} name - チャンネル名
 */
interface Channel {
  _id: string;
  name: string;
}

/**
 * メッセージインターフェース。
 * @typedef {Object} Message
 * @property {string} _id - メッセージID
 * @property {string} channelId - チャンネルID
 * @property {string} userId - ユーザーID
 * @property {string} username - ユーザー名
 * @property {string} content - メッセージ内容
 * @property {string | null} parentId - 親メッセージID (スレッド用、nullの場合はトップレベルメッセージ)
 * @property {string} timestamp - メッセージのタイムスタンプ
 */
interface Message {
  _id: string;
  channelId: string;
  userId: string;
  username: string;
  content: string;
  parentId: string | null;
  timestamp: string;
}

/**
 * チャットページコンポーネント。
 * チャンネルリスト、メッセージ表示、メッセージ送信機能を提供します。
 * @returns {JSX.Element} チャットページ
 */
export default function ChatPage() {
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const authenticateSocket = async () => {
      try {
        const response = await fetch('/api/backend/socket-auth');
        if (!response.ok) {
          // トークンがない、または無効な場合はログインページへリダイレクト
          router.push('/login');
          return;
        }
        const data = await response.json();
        const token = data.token;

        if (socket && !isConnected && token) {
          socket.auth = { token };
          socket.connect();
        }
        if (!token) {
          router.push('/login');
          return;
        }
      } catch (err) {
        console.error('Socket authentication failed:', err);
        router.push('/login');
      }
    };

    authenticateSocket();
  }, [router, socket, isConnected]);

  useEffect(() => {
    if (isConnected && socket) {
      /**
       * チャンネルリストをバックエンドから取得します。
       * @async
       * @function fetchChannels
       */
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
      /**
       * 特定のチャンネルのメッセージ履歴をバックエンドから取得します。
       * @async
       * @function fetchMessages
       * @param {string} channelId - メッセージを取得するチャンネルのID
       */
      fetchMessages(selectedChannel._id);
      if (socket && isConnected) {
        socket.emit('joinChannel', selectedChannel._id);
      }
    }
  }, [selectedChannel, socket, isConnected]);

  /**
   * チャンネルリストをバックエンドから取得します。
   * @async
   * @function fetchChannels
   */
  const fetchChannels = async () => {
    try {
      const response = await fetch('/api/backend/channels'); // rewritesを使用
      if (!response.ok) {
        throw new Error('Failed to fetch channels');
      }
      const data = await response.json();
      setChannels(data);
      if (data.length > 0 && !selectedChannel) {
        setSelectedChannel(data[0]); // デフォルトで最初のチャンネルを選択
      }
    } catch (err: unknown) {
      let errorMessage = 'An unknown error occurred'; // デフォルトのエラーメッセージ

      // err が message プロパティを持つオブジェクトの場合
      if (typeof err === 'object' && err !== null && 'message' in err) {
        errorMessage = (err as { message: string }).message;
      }

      setError(errorMessage);
    }
  };

  /**
   * 特定のチャンネルのメッセージ履歴をバックエンドから取得します。
   * HTTP Only Cookieは自動的に送信されるため、明示的なAuthorizationヘッダーは不要です。
   * @async
   * @function fetchMessages
   * @param {string} channelId - メッセージを取得するチャンネルのID
   */
  const fetchMessages = async (channelId: string) => {
    try {
      const response = await fetch(`/api/backend/channels/${channelId}/messages`); // rewritesを使用
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      const data = await response.json();
      setMessages(data);
    } catch (err: unknown) {
      let errorMessage = 'An unknown error occurred'; // デフォルトのエラーメッセージ

      // err が message プロパティを持つオブジェクトの場合
      if (typeof err === 'object' && err !== null && 'message' in err) {
        errorMessage = (err as { message: string }).message;
      }

      setError(errorMessage);
    }
  };

  /**
   * メッセージ送信ハンドラ。
   * 入力されたメッセージをSocket.io経由で送信します。
   * @param {FormEvent} e - フォームイベントオブジェクト
   */
  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) {
      setError('メッセージを入力してください。');
      return;
    }
    // TODO: メッセージのバリデーションとサニタイズを強化 (例: 文字数制限、HTMLエスケープ)
    // 現時点では簡易的なサニタイズとして、HTMLタグをエスケープする処理を検討
    const sanitizedMessage = trimmedMessage.replace(/</g, '<').replace(/>/g, '>');

    if (socket && isConnected && selectedChannel) {
      socket.emit('sendMessage', { channelId: selectedChannel._id, content: sanitizedMessage });
      setNewMessage('');
      setError(''); // エラーをクリア
    }
  };

  /**
   * ログアウトハンドラ。
   * JWTトークンを削除し、Socket.io接続を切断してログインページへリダイレクトします。
   * @async
   * @function handleLogout
   */
  const handleLogout = async () => {
    try {
      // HTTP Only CookieをクリアするためにAPIルートを呼び出す
      await fetch('/api/backend/auth/logout', { // rewritesを使用
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Logout API call failed:', err);
      // エラーが発生しても、フロントエンドの状態はクリアしてリダイレクトする
    } finally {
      // localStorage.removeItem('jwtToken'); // HTTP Only Cookieからの削除に変更済み
      if (socket) {
        socket.disconnect();
      }
      router.push('/login');
    }
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
      <ChannelList
        channels={channels}
        selectedChannel={selectedChannel}
        onSelectChannel={setSelectedChannel}
        onLogout={handleLogout}
      />

      {/* メインチャットエリア */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-white p-4 shadow-md">
          <h1 className="text-xl font-bold">
            {selectedChannel ? `#${selectedChannel.name}` : 'チャンネルを選択'}
          </h1>
          {/* オンラインユーザー表示など、将来的に追加 */}
        </header>

        <MessageList messages={messages} />

        <MessageInput
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          onSendMessage={handleSendMessage}
          selectedChannel={selectedChannel}
          error={error}
        />
      </div>
    </div>
  );
}
