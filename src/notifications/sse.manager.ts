import { Response } from 'express';

interface SSEClient {
  id: string;
  userId: string;
  userRole?: string;
  res: Response;
}

export class SSEManager {
  private static instance: SSEManager;
  private clients: Map<string, SSEClient> = new Map();

  public static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager();
    }
    return SSEManager.instance;
  }

  /**
   * Registers a client for Server-Sent Events.
   */
  public registerClient(clientId: string, userId: string, res: Response, userRole?: string): void {
    // Set headers for SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering

    // Send initial handshake event
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId, userId, timestamp: new Date().toISOString() })}\n\n`);

    const client: SSEClient = { id: clientId, userId, userRole, res };
    this.clients.set(clientId, client);

    // Keep connection alive with periodic ping
    const keepAliveInterval = setInterval(() => {
      if (this.clients.has(clientId)) {
        res.write(': ping\n\n');
      } else {
        clearInterval(keepAliveInterval);
      }
    }, 25000);

    // Handle client disconnect
    res.on('close', () => {
      clearInterval(keepAliveInterval);
      this.clients.delete(clientId);
    });
  }

  /**
   * Pushes a real-time event to a specific user across all their open tabs/clients.
   */
  public sendToUser(userId: string, eventName: string, data: unknown): number {
    let sentCount = 0;
    const payloadString = JSON.stringify(data);

    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        client.res.write(`event: ${eventName}\ndata: ${payloadString}\n\n`);
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Broadcasts a real-time event to all connected clients of a specific role (e.g. HR or ADMIN).
   */
  public broadcastToRole(role: string, eventName: string, data: unknown): number {
    let sentCount = 0;
    const payloadString = JSON.stringify(data);

    for (const client of this.clients.values()) {
      if (client.userRole === role || role === 'ALL') {
        client.res.write(`event: ${eventName}\ndata: ${payloadString}\n\n`);
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Returns active connection count.
   */
  public getActiveClientCount(): number {
    return this.clients.size;
  }

  public clear(): void {
    for (const client of this.clients.values()) {
      try {
        client.res.end();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
  }
}
