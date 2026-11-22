import express from 'express';
import axios from 'axios';
import { setTimeout as wait } from 'node:timers/promises';
import { isSendRequest } from '../src/shared/contracts.ts';
import type { ReceiveRequest, SendRequest } from '../src/shared/contracts.ts';

const port = Number(process.env.MOCK_PORT ?? '4000');
const appUrl = process.env.APP_BASE_URL ?? 'http://127.0.0.1:3000';
const delay = Number(process.env.MOCK_DELAY_MS ?? '1200');
const partInterval = 450;
const receiveUrl = new URL('/api/receive', appUrl).href;
const app = express();
app.use(express.json({ limit: '8kb' }));

function mockOutlineParts(topic: string) {
  const singleLineTopic = topic.replace(/\s+/g, ' ');
  return [
    ['1. Введение', `1.1. Актуальность темы «${singleLineTopic}»`, '1.2. Цель и задачи'],
    ['2. Обзор предметной области', '2.1. Основные понятия', '2.2. Существующие подходы'],
    ['3. Постановка задачи', '3.1. Требования и ограничения', '3.2. Критерии оценки'],
    ['4. Практическая часть', '4.1. Методика работы', '4.2. Применение выбранного подхода'],
    ['5. Анализ результатов', '5.1. Оценка по заданным критериям', '5.2. Ограничения и выводы'],
    ['6. Заключение', '6.1. Итоги работы', '6.2. Дальнейшие направления'],
  ].map((lines) => lines.join('\n'));
}

async function postResult(result: ReceiveRequest) {
  try {
    await axios.post(receiveUrl, result, { timeout: 3_000 });
    return true;
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status ?? error.code : undefined;
    console.error(`Receive для ${result.timestamp}: ${status ?? 'ошибка запроса'}`);
    return false;
  }
}

async function deliverResult({ sender, timestamp, document_topic }: SendRequest) {
  const scenario = document_topic.trim().toLowerCase();
  const failure: ReceiveRequest = { sender, timestamp, error: true, payload: null };
  if (scenario === 'ошибка сборки') {
    await postResult(failure);
    return;
  }

  const parts = mockOutlineParts(document_topic);
  const hasLoss = scenario === 'потеря сегментов';
  const deliveredParts = hasLoss ? parts.slice(0, 2) : parts;
  for (const [index, payload] of deliveredParts.entries()) {
    if (index > 0) await wait(partInterval);
    const accepted = await postResult({
      sender, timestamp, error: false, payload,
      part_number: index + 1,
      total_parts: parts.length,
    });
    if (!accepted) return;
  }

  if (hasLoss) {
    await wait(2_000);
    await postResult(failure);
  }
}

app.post('/api/v1/send', (request, response) => {
  const message: unknown = request.body;
  if (!isSendRequest(message)) {
    response.status(400).json({ message: 'Некорректный формат темы.' });
    return;
  }

  response.sendStatus(202);
  setTimeout(() => void deliverResult(message), delay);
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Заглушка транспорта: http://127.0.0.1:${port}`);
});
