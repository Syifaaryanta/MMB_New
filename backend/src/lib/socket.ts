import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server | null = null;

export function initSocketServer(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins for LAN / local multi-computer access
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`⚡ [Socket.IO] Client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`⚡ [Socket.IO] Client disconnected (${socket.id}): ${reason}`);
    });
  });

  console.log('⚡ [Socket.IO] Real-time WebSocket server initialized.');
  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io has not been initialized!');
  }
  return io;
}

export function emitRealtimeEvent(event: string, payload: any) {
  if (io) {
    console.log(`📡 [Socket.IO] Broadcasting event: "${event}"`, payload);
    io.emit(event, payload);
  }
}
