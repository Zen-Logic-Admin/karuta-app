import { io } from 'socket.io-client';

// 開発時はlocalhost:3001、本番は同一オリジン（Renderで同居）
const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3001' : undefined;

export const socket = io(SOCKET_URL, { autoConnect: false });
