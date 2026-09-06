import type { WebSocket } from 'ws';

export class Broadcaster {
  private readonly clients = new Set<WebSocket>();

  add(client: WebSocket) { this.clients.add(client); }
  remove(client: WebSocket) { this.clients.delete(client); }
  count() { return this.clients.size; }

  send(message: unknown) {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === 1) client.send(payload);
    }
  }
}
