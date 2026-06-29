import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../api/client';

let sharedSocket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (sharedSocket?.connected) return sharedSocket;

  const token = await SecureStore.getItemAsync('auth_token');
  sharedSocket = io(API_URL, {
    transports: ['websocket'],
    auth: { token },
  });
  return sharedSocket;
}

export function disconnectSocket() {
  sharedSocket?.disconnect();
  sharedSocket = null;
}

export function useSocketEvent<T = any>(
  event: string,
  handler: (data: T) => void,
  deps: any[] = []
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    let socket: Socket;
    let mounted = true;

    getSocket().then((s) => {
      if (!mounted) return;
      socket = s;
      const fn = (data: T) => handlerRef.current(data);
      socket.on(event, fn);
      return () => { socket?.off(event, fn); };
    });

    return () => { mounted = false; };
  }, deps);
}
