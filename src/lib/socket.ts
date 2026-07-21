import { io, Socket } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';
import { API_ORIGIN } from './config';

let socket: any;

if (typeof window !== 'undefined') {
  const options = { path: '/socket.io', autoConnect: false };
  const targetUrl = API_ORIGIN || window.location.origin;
  socket = io(targetUrl, options);
} else {
  // Safe mock socket object for Node SSR environment
  socket = {
    on: () => {},
    off: () => {},
    emit: () => {},
    connect: () => {},
    disconnect: () => {},
  };
}

export const connectSocket = () => {
  if (socket && typeof window !== 'undefined' && !socket.connected) {
    console.log('[Socket] Connecting manually...');
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket && typeof window !== 'undefined' && socket.connected) {
    console.log('[Socket] Disconnecting manually...');
    socket.disconnect();
  }
};

export const joinRoom = (roomId: string) => {
  if (socket && typeof window !== 'undefined') {
    // Ensure we are connected before joining
    if (!socket.connected) {
      socket.connect();
    }
    console.log(`[Socket] Joining room: ${roomId}`);
    socket.emit('join-room', roomId);
    socket.emit('joinRoom', roomId);
  }
};

export default socket;
