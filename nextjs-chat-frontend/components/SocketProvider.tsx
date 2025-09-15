'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_IO_URL || 'http://localhost: 5000';
    const newSocket = io(socketUrl, {
      autoConnect: false,
      withCredentials: true, // HTTP Only Cookieを送信するために必要
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (socket && !isConnected) {
      // JWTトークンが更新された場合などに再接続を試みる
      const token = localStorage.getItem('jwtToken');
      if (token) {
        socket.auth = { token };
        socket.connect();
      }
    }
  }, [socket, isConnected]);


  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
