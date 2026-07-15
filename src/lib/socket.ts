import { io, Socket } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';
import { API_ORIGIN } from './config';

let socket: any;

if (typeof window !== 'undefined') {
  if (Capacitor.isNativePlatform()) {
    socket = io(API_ORIGIN, { path: '/socket.io' });
  } else {
    socket = io();
  }
} else {
  // Safe mock socket object for Node SSR environment
  socket = {
    on: () => {},
    off: () => {},
    emit: () => {},
  };
}

export const joinRoom = (roomId: string) => {
  if (socket && typeof window !== 'undefined') {
    console.log(`[Socket] Joining room: ${roomId}`);
    socket.emit('join-room', roomId);
    socket.emit('joinRoom', roomId);
  }
};

export default socket;
