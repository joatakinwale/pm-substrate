/**
 * OrgChannel — the per-org Durable Object that fans out events to subscribers.
 *
 * One instance per org_id (lookup by env.ORG_CHANNEL.idFromName(org_id)).
 * Holds the active SSE writers and WebSocket connections in memory. When
 * the parent Worker forwards a publish, we iterate the live connections
 * and write the event to each.
 *
 * State model:
 *   - In-memory Map<connId, ConnectionRecord>. Connections are ephemeral;
 *     if the DO hibernates (no activity for ~10s) the WebSocket
 *     Hibernation API rehydrates them from the runtime's internal state,
 *     so we don't persist anything to SQLite for now.
 *   - SSE writers can NOT survive hibernation (they use streams), so an
 *     idle DO will close them eventually. The browser EventSource
 *     auto-reconnects, which is fine.
 *
 * Wire formats:
 *   - SSE: each event becomes "data: <json>\n\n". A 30s heartbeat sends
 *     ": ping\n\n" (a comment line) to defeat proxy idle timeouts.
 *   - WebSocket: each event is sent as a JSON text frame. The client may
 *     send {"type": "ping"} which we reply to with {"type": "pong"};
 *     anything else is currently ignored.
 */

interface ConnectionRecord {
  /** Either an SSE writer or null (WS connections are tracked by the runtime). */
  sseWriter: WritableStreamDefaultWriter<Uint8Array> | null;
  /** Heartbeat interval id (only set for SSE). */
  heartbeat: ReturnType<typeof setInterval> | null;
}

const SSE_HEARTBEAT_MS = 30_000;
const SSE_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  connection: "keep-alive",
  // Disable nginx-style proxy buffering. FastAPI sets the same.
  "x-accel-buffering": "no",
} as const;

export class OrgChannel implements DurableObject {
  private state: DurableObjectState;
  private sseConnections: Map<string, ConnectionRecord>;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
    this.sseConnections = new Map();
  }

  /**
   * The DO has one fetch handler that multiplexes by URL path:
   *   POST /internal/publish    — fan out an event to all subscribers
   *   GET  /subscribe/{org_id}  — open SSE or WS for this client
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (
      request.method === "POST" &&
      url.pathname === "/internal/publish"
    ) {
      return this.handleInternalPublish(request);
    }

    if (
      request.method === "GET" &&
      url.pathname.startsWith("/subscribe/")
    ) {
      const upgrade = request.headers.get("upgrade")?.toLowerCase();
      if (upgrade === "websocket") {
        return this.handleWebSocketUpgrade();
      }
      return this.handleSseSubscribe();
    }

    return new Response("not found", { status: 404 });
  }

  // ── Publish path ───────────────────────────────────────────────

  private async handleInternalPublish(request: Request): Promise<Response> {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    const json = JSON.stringify(payload);
    const sseFrame = encodeSseDataFrame(json);

    // Fan out to SSE clients. We don't await the writer.write() in a way
    // that holds up other clients — a slow client shouldn't starve the
    // others. Failed writes drop the connection.
    const sseDeadIds: string[] = [];
    for (const [id, conn] of this.sseConnections.entries()) {
      if (!conn.sseWriter) continue;
      try {
        await conn.sseWriter.write(sseFrame);
      } catch {
        sseDeadIds.push(id);
      }
    }
    for (const id of sseDeadIds) {
      this.cleanupSseConnection(id);
    }

    // Fan out to WebSocket clients. The Hibernation API gives us back the
    // currently-attached sockets; we just send() to each.
    const wsClients = this.state.getWebSockets();
    for (const ws of wsClients) {
      try {
        ws.send(json);
      } catch {
        // The runtime will fire webSocketClose for us on a broken socket.
      }
    }

    return new Response(null, { status: 200 });
  }

  // ── SSE subscribe path ─────────────────────────────────────────

  private handleSseSubscribe(): Response {
    // Make a TransformStream so we can hand the readable to the response
    // and keep writing to the writable as events arrive. This is the
    // standard Workers SSE pattern.
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const connId = crypto.randomUUID();

    // Initial handshake event so the client sees something immediately.
    const hello = JSON.stringify({ event: "connected" });
    void writer.write(encoder.encode(`data: ${hello}\n\n`));

    // Heartbeat — SSE comment line every 30s so proxies don't time out.
    const heartbeat = setInterval(() => {
      writer.write(encoder.encode(`: ping\n\n`)).catch(() => {
        this.cleanupSseConnection(connId);
      });
    }, SSE_HEARTBEAT_MS);

    this.sseConnections.set(connId, {
      sseWriter: writer,
      heartbeat,
    });

    return new Response(readable, {
      status: 200,
      headers: SSE_HEADERS,
    });
  }

  private cleanupSseConnection(connId: string): void {
    const conn = this.sseConnections.get(connId);
    if (!conn) return;
    if (conn.heartbeat) clearInterval(conn.heartbeat);
    if (conn.sseWriter) {
      conn.sseWriter.close().catch(() => {});
    }
    this.sseConnections.delete(connId);
  }

  // ── WebSocket subscribe path ───────────────────────────────────

  private handleWebSocketUpgrade(): Response {
    // Standard CF WebSocketPair — server side stays in the DO, client side
    // is returned to the caller in the 101 response.
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    // acceptWebSocket enables the Hibernation API: the runtime takes
    // ownership of the socket and will rehydrate this DO and call
    // webSocketMessage / webSocketClose when traffic arrives, even after
    // the DO has been evicted from memory. That means we don't need to
    // hold a reference in this.sseConnections.
    this.state.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Hibernation API hook: called when a client sends a message. We use
   * this for app-level pings only — clients don't otherwise drive state.
   */
  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    let parsed: unknown;
    try {
      parsed =
        typeof message === "string"
          ? JSON.parse(message)
          : JSON.parse(new TextDecoder().decode(message));
    } catch {
      return; // ignore malformed frames
    }

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { type?: unknown }).type === "ping"
    ) {
      ws.send(JSON.stringify({ type: "pong" }));
    }
    // Other client-initiated message types: stub. Add handlers here if we
    // ever want clients to subscribe to a sub-channel or ack-confirm
    // events.
  }

  /**
   * Hibernation API hook: called when a client disconnects. We don't keep
   * any per-WS state in memory (the runtime handles the socket itself),
   * so this is effectively a no-op — kept here for clarity and future use.
   */
  async webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean
  ): Promise<void> {
    // No-op. SSE connections are tracked separately in this.sseConnections.
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function encodeSseDataFrame(json: string): Uint8Array {
  return new TextEncoder().encode(`data: ${json}\n\n`);
}
