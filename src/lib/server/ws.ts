// src/lib/server/ws.ts — WebSocket connection registry + broadcast
// SvelteKit doesn't natively handle WS upgrades, so we manage connections here
// and upgrade in the /api/ws route handler.

import type { WsMessage } from '$lib/types';

// Set of active WebSocket connections
const connections = new Set<WebSocket>();

export function addConnection(ws: WebSocket): void {
  connections.add(ws);
  ws.addEventListener('close', () => connections.delete(ws));
}

export function broadcast(message: WsMessage): void {
  const data = JSON.stringify(message);
  for (const ws of connections) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

export function broadcastToSession(session_id: string, message: WsMessage): void {
  // In a multi-session system we'd filter by session; for kiosk, broadcast to all
  broadcast(message);
}
