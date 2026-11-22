export const MAX_TOPIC_LENGTH = 300;
const MAX_OUTLINE_PARTS = 64;

export interface LoginRequest {
  login: string;
}

export interface User {
  login: string;
  name: string;
}

export interface SessionResponse {
  user: User | null;
}

export interface GenerateRequest {
  document_topic: string;
}

export interface GenerateResponse {
  timestamp: number;
}

interface MessageId {
  sender: string;
  timestamp: number;
}

export type SendRequest = MessageId & GenerateRequest;

type OutlineSuccess = { error: false; payload: string };
type OutlineFailure = { error: true; payload: null };

export type ReceiveRequest = MessageId & (
  | (OutlineSuccess & { part_number?: never; total_parts?: never })
  | (OutlineSuccess & { part_number: number; total_parts: number })
  | (OutlineFailure & { part_number?: never; total_parts?: never })
);

export type OutlineEvent = MessageId & (
  | (OutlineSuccess & { progress?: { received: number; total: number } })
  | (OutlineFailure & { reason?: 'timeout' })
);

export interface ApiError {
  message: string;
}

function isMessageId(value: unknown): value is MessageId & Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const { sender, timestamp } = value as Record<string, unknown>;
  return (
    typeof sender === 'string' &&
    sender.trim().length > 0 &&
    typeof timestamp === 'number' &&
    Number.isSafeInteger(timestamp) &&
    timestamp > 0
  );
}

export function isSendRequest(value: unknown): value is SendRequest {
  return (
    isMessageId(value) &&
    typeof value.document_topic === 'string' &&
    value.document_topic.trim().length > 0 &&
    value.document_topic.length <= MAX_TOPIC_LENGTH
  );
}

function isOutlineResult(value: unknown): value is MessageId &
  (OutlineSuccess | OutlineFailure) & Record<string, unknown> {
  if (!isMessageId(value)) return false;
  return (
    (value.error === false && typeof value.payload === 'string' && !!value.payload.trim()) ||
    (value.error === true && value.payload === null)
  );
}

function isPartCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_OUTLINE_PARTS;
}

export function isReceiveRequest(value: unknown): value is ReceiveRequest {
  if (!isOutlineResult(value)) return false;
  const { part_number, total_parts } = value;
  if (part_number === undefined && total_parts === undefined) return true;
  return !value.error && isPartCount(part_number) && isPartCount(total_parts) && part_number <= total_parts;
}

export function isOutlineEvent(value: unknown): value is OutlineEvent {
  if (!isOutlineResult(value)) return false;
  if (value.error) return value.reason === undefined || value.reason === 'timeout';
  if (value.progress === undefined) return true;
  if (typeof value.progress !== 'object' || value.progress === null) return false;
  const { received, total } = value.progress as Record<string, unknown>;
  return isPartCount(received) && isPartCount(total) && received <= total;
}
