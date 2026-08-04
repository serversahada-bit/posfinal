'use client';

import { useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';

export const useSocketEvent = (eventName: string, callback: (data?: unknown) => void) => {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      return;
    }
    
    const listener = (data?: unknown) => {
      if (savedCallback.current) {
        savedCallback.current(data);
      }
    };

    socket.on(eventName, listener);

    return () => {
      socket.off(eventName, listener);
    };
  }, [eventName]);
};
