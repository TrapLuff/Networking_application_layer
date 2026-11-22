import type { Response } from 'express';
import type { OutlineEvent } from '../shared/contracts.ts';

const streams = new Map<string, Set<Response>>();

export function hasStreams(sessionId: string) {
  return streams.has(sessionId);
}

export function openStream(sessionId: string, response: Response) {
  response.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });

  const connections = streams.get(sessionId) ?? new Set<Response>();
  connections.add(response);
  streams.set(sessionId, connections);

  const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15_000);
  heartbeat.unref();

  response.on('close', () => {
    clearInterval(heartbeat);
    connections.delete(response);
    if (connections.size === 0 && streams.get(sessionId) === connections) {
      streams.delete(sessionId);
    }
  });

  response.flushHeaders();
  response.write(': connected\n\n');
}

export function sendOutline(sessionId: string, event: OutlineEvent) {
  const frame = `event: outline\ndata: ${JSON.stringify(event)}\n\n`;
  for (const response of streams.get(sessionId) ?? []) {
    response.write(frame);
  }
}

export function closeStreams(sessionId: string) {
  const connections = streams.get(sessionId);
  streams.delete(sessionId);
  for (const response of connections ?? []) {
    response.end();
  }
}
