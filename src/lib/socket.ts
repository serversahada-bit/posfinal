import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

let socket: Socket | null = null;

const isLocalHostname = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1';

const normalizeBrowserSocketUrl = (rawUrl: string): string => {
  if (typeof window === 'undefined') {
    return rawUrl;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (window.location.protocol === 'https:' && trimmed.startsWith('ws://')) {
    return `wss://${trimmed.slice(5)}`;
  }

  if (window.location.protocol === 'https:' && trimmed.startsWith('http://')) {
    return `https://${trimmed.slice(7)}`;
  }

  if (window.location.protocol === 'http:' && trimmed.startsWith('https://')) {
    return `http://${trimmed.slice(8)}`;
  }

  return trimmed;
};

export const getBrowserSocketUrl = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (process.env.NEXT_PUBLIC_WS_URL) {
    return normalizeBrowserSocketUrl(process.env.NEXT_PUBLIC_WS_URL);
  }

  if (isLocalHostname(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return `${window.location.protocol}//${window.location.hostname}:3001`;
};

export const getSocket = (): Socket | null => {
  if (typeof window === 'undefined') {
    throw new Error('getSocket() should only be called on the client side');
  }

  if (!socket) {
    const socketUrl = getBrowserSocketUrl();
    if (!socketUrl) {
      return null;
    }

    socket = io(socketUrl, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (!socket) {
    return;
  }

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
};
