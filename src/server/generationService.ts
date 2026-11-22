import type { ReceiveRequest } from '../shared/contracts.ts';
import { sendOutline } from './sseConnections.ts';

interface PendingGeneration {
  sessionId: string;
  sender: string;
  timer: NodeJS.Timeout;
  parts?: { total: number; payloads: Map<number, string> };
}

const pending = new Map<number, PendingGeneration>();
let lastTimestamp = 0;

export function startGeneration(sessionId: string, sender: string, timeoutMs: number) {
  const timestamp = Math.max(Date.now(), lastTimestamp + 1);
  lastTimestamp = timestamp;

  const timer = setTimeout(() => {
    pending.delete(timestamp);
    sendOutline(sessionId, { sender, timestamp, error: true, payload: null, reason: 'timeout' });
  }, timeoutMs);
  timer.unref();

  pending.set(timestamp, { sessionId, sender, timer });
  return timestamp;
}

export function cancelGeneration(timestamp: number) {
  const generation = pending.get(timestamp);
  if (!generation) return;

  clearTimeout(generation.timer);
  pending.delete(timestamp);
}

export function cancelSessionGenerations(sessionId: string) {
  for (const [timestamp, generation] of pending) {
    if (generation.sessionId === sessionId) cancelGeneration(timestamp);
  }
}

export function receiveOutline(message: ReceiveRequest): 'accepted' | 'unknown' | 'conflict' {
  const { timestamp, sender, error, payload, part_number, total_parts } = message;
  const generation = pending.get(timestamp);
  if (!generation || generation.sender !== sender) return 'unknown';
  const { sessionId } = generation;

  if (error) {
    cancelGeneration(timestamp);
    sendOutline(sessionId, { sender, timestamp, error: true, payload: null });
    return 'accepted';
  }

  if (part_number === undefined) {
    if (generation.parts) return 'conflict';
    cancelGeneration(timestamp);
    sendOutline(sessionId, { sender, timestamp, error: false, payload });
    return 'accepted';
  }

  const parts = generation.parts ??= { total: total_parts, payloads: new Map() };
  if (parts.total !== total_parts) return 'conflict';
  const previous = parts.payloads.get(part_number);
  if (previous !== undefined) return previous === payload ? 'accepted' : 'conflict';

  parts.payloads.set(part_number, payload);
  const received = parts.payloads.size;
  const orderedPayload = [...parts.payloads]
    .sort(([left], [right]) => left - right)
    .map(([, part]) => part)
    .join('\n');

  if (received === parts.total) cancelGeneration(timestamp);
  sendOutline(sessionId, {
    sender,
    timestamp,
    error: false,
    payload: orderedPayload,
    progress: { received, total: parts.total },
  });
  return 'accepted';
}
