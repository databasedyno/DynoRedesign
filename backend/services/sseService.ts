/**
 * Server-Sent Events (SSE) Service
 * 
 * Provides real-time push from server to client for:
 * - Payment status updates
 * - Price ticker updates
 * - System notifications
 * - Dashboard live data
 */
import { Response } from "express";
import { apiLogger } from "../utils/loggers";

interface SSEClient {
  id: string;
  user_id: number;
  res: Response;
  channels: Set<string>;
  connected_at: Date;
  last_ping: Date;
}

// In-memory client registry
const clients: Map<string, SSEClient> = new Map();

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;
let heartbeatTimer: NodeJS.Timeout | null = null;

/**
 * Register a new SSE client
 */
export const registerClient = (clientId: string, userId: number, res: Response, channels: string[] = []): void => {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable nginx buffering
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ client_id: clientId, channels })}\n\n`);

  const client: SSEClient = {
    id: clientId,
    user_id: userId,
    res,
    channels: new Set(channels),
    connected_at: new Date(),
    last_ping: new Date(),
  };

  clients.set(clientId, client);

  // Handle disconnect
  res.on("close", () => {
    clients.delete(clientId);
    apiLogger.info(`[SSE] Client ${clientId} (user ${userId}) disconnected. Active: ${clients.size}`);
  });

  apiLogger.info(`[SSE] Client ${clientId} (user ${userId}) connected on channels: [${channels.join(", ")}]. Active: ${clients.size}`);

  // Start heartbeat if first client
  if (clients.size === 1 && !heartbeatTimer) {
    startHeartbeat();
  }
};

/**
 * Send event to a specific user
 */
export const sendToUser = (userId: number, event: string, data: unknown): number => {
  let sent = 0;
  for (const client of clients.values()) {
    if (client.user_id === userId) {
      try {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        sent++;
      } catch (err) {
        clients.delete(client.id);
      }
    }
  }
  return sent;
};

/**
 * Send event to all clients on a specific channel
 */
export const sendToChannel = (channel: string, event: string, data: unknown): number => {
  let sent = 0;
  for (const client of clients.values()) {
    if (client.channels.has(channel)) {
      try {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        sent++;
      } catch (err) {
        clients.delete(client.id);
      }
    }
  }
  return sent;
};

/**
 * Broadcast to ALL connected clients
 */
export const broadcast = (event: string, data: unknown): number => {
  let sent = 0;
  for (const client of clients.values()) {
    try {
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      sent++;
    } catch (err) {
      clients.delete(client.id);
    }
  }
  return sent;
};

/**
 * Emit a payment status update to the relevant user
 */
export const emitPaymentUpdate = (userId: number, paymentData: {
  transaction_id: string;
  status: string;
  payment_status?: string;
  amount?: number;
  currency?: string;
}): void => {
  const sent = sendToUser(userId, "payment_update", paymentData);
  if (sent > 0) {
    apiLogger.info(`[SSE] Payment update sent to user ${userId}: ${paymentData.status}`);
  }
};

/**
 * Emit a price update to all clients on the 'prices' channel
 */
export const emitPriceUpdate = (prices: Record<string, number>): void => {
  sendToChannel("prices", "price_update", { prices, timestamp: Date.now() });
};

/**
 * Emit a notification to a specific user
 */
export const emitNotification = (userId: number, notification: {
  id: number;
  type: string;
  title: string;
  message: string;
}): void => {
  sendToUser(userId, "notification", notification);
};

/**
 * Get SSE stats
 */
export const getSSEStats = (): {
  total_clients: number;
  clients_by_channel: Record<string, number>;
  uptime_seconds: number;
} => {
  const channelCounts: Record<string, number> = {};
  for (const client of clients.values()) {
    for (const ch of client.channels) {
      channelCounts[ch] = (channelCounts[ch] || 0) + 1;
    }
  }

  return {
    total_clients: clients.size,
    clients_by_channel: channelCounts,
    uptime_seconds: heartbeatTimer ? HEARTBEAT_INTERVAL / 1000 : 0,
  };
};

/**
 * Heartbeat — keeps connections alive and cleans dead clients
 */
const startHeartbeat = (): void => {
  heartbeatTimer = setInterval(() => {
    const now = new Date();
    for (const [id, client] of clients.entries()) {
      try {
        client.res.write(`:heartbeat ${now.toISOString()}\n\n`);
        client.last_ping = now;
      } catch (err) {
        clients.delete(id);
      }
    }

    // Stop heartbeat if no clients
    if (clients.size === 0 && heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }, HEARTBEAT_INTERVAL);
};

export default {
  registerClient,
  sendToUser,
  sendToChannel,
  broadcast,
  emitPaymentUpdate,
  emitPriceUpdate,
  emitNotification,
  getSSEStats,
};
