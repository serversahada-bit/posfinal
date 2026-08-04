'use client';

import { useEffect, useRef } from 'react';
import { getBrowserSocketUrl, getSocket } from '@/lib/socket';

export default function RealtimeConnection() {
  const hasShownTimeoutWarningRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    const socketUrl = getBrowserSocketUrl();

    if (!socket) {
      console.warn('RealtimeConnection: NEXT_PUBLIC_WS_URL belum dikonfigurasi atau URL socket tidak tersedia.');
      return;
    }

    const handleConnect = () => {
      hasShownTimeoutWarningRef.current = false;
      console.log(`Realtime socket connected: ${socket.id}`);
    };

    const handleConnectError = (error: Error) => {
      if (error.message === 'timeout') {
        if (!hasShownTimeoutWarningRef.current) {
          hasShownTimeoutWarningRef.current = true;
          console.warn(`Realtime socket timeout ke ${socketUrl || 'server websocket'}. Pastikan server realtime aktif, misalnya lewat 'npm run dev' atau 'npm run start:full'.`);
        }
        return;
      }

      console.warn('Realtime socket connect_error:', error.message);
    };

    const handleDisconnect = (reason: string) => {
      console.warn(`Realtime socket disconnected: ${reason}`);
    };

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  return null;
}
