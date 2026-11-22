import { Router } from 'express';
import type { RequestHandler } from 'express';
import { isReceiveRequest, MAX_TOPIC_LENGTH } from '../shared/contracts.ts';
import { cancelGeneration, receiveOutline, startGeneration } from './generationService.ts';
import { hasStreams, openStream } from './sseConnections.ts';
import { sendToTransport } from './transportClient.ts';

const requireUser: RequestHandler = (request, response, next) => {
  if (!request.session.user) {
    response.status(401).json({ message: 'Войдите, чтобы продолжить.' });
    return;
  }
  next();
};

export const receiveOutlineResult: RequestHandler = (request, response) => {
  const body: unknown = request.body;
  if (!isReceiveRequest(body)) {
    response.status(400).json({ message: 'Некорректный формат результата.' });
    return;
  }

  const result = receiveOutline(body);
  if (result === 'unknown') {
    response.status(404).json({ message: 'Активный запрос не найден.' });
    return;
  }
  if (result === 'conflict') {
    response.status(409).json({ message: 'Часть противоречит уже полученным данным.' });
    return;
  }

  response.status(200).end();
};

export function outlineRoutes(transportUrl: string, timeoutMs: number) {
  const router = Router();

  router.get('/events', requireUser, (request, response) => {
    openStream(request.sessionID, response);
  });

  router.post('/generate', requireUser, async (request, response) => {
    const { document_topic } = request.body ?? {};
    const topic = typeof document_topic === 'string' ? document_topic.trim() : '';
    if (!topic || topic.length > MAX_TOPIC_LENGTH) {
      response.status(400).json({ message: `Введите тему длиной от 1 до ${MAX_TOPIC_LENGTH} символов.` });
      return;
    }
    if (!hasStreams(request.sessionID)) {
      response.status(409).json({ message: 'Подключитесь к потоку результатов и повторите запрос.' });
      return;
    }

    const sender = request.session.user!.login;
    const timestamp = startGeneration(request.sessionID, sender, timeoutMs);

    try {
      await sendToTransport(transportUrl, { sender, timestamp, document_topic: topic });
    } catch {
      cancelGeneration(timestamp);
      response.status(502).json({ message: 'Транспорт недоступен. Попробуйте ещё раз.' });
      return;
    }

    response.status(202).json({ timestamp });
  });

  return router;
}
