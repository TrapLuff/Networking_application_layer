import { isIPv4 } from 'node:net';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import session from 'express-session';
import { readFileSync } from 'node:fs';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';
import { outlineRoutes, receiveOutlineResult } from './src/server/outlineRoutes.ts';
import { SESSION_COOKIE, sessionRoutes } from './src/server/sessionRoutes.ts';

const { env } = process;
const secret = env.SESSION_SECRET;
if (!secret) throw new Error('Задайте SESSION_SECRET в .env.');

const users = [1, 2].map((index) => {
  const login = env[`TEST_USER_${index}_LOGIN`]?.trim();
  const name = env[`TEST_USER_${index}_NAME`]?.trim();
  if (!login || !name) throw new Error(`Заполните TEST_USER_${index}_* в .env.`);
  return { login, name };
});
if (users[0].login === users[1].login) throw new Error('У тестовых пользователей должны быть разные логины.');

const port = Number(env.APP_PORT ?? '3000');
const receiveHost = env.APP_RECEIVE_HOST?.trim();
if (receiveHost && (!isIPv4(receiveHost) || receiveHost === '0.0.0.0')) {
  throw new Error('Укажите в APP_RECEIVE_HOST конкретный локальный IPv4-адрес.');
}
const transportUrl = new URL(env.TRANSPORT_BASE_URL ?? 'http://127.0.0.1:4000');
const logTransportResponses = env.LOG_TRANSPORT_RESPONSES === '1';
const timeoutMs = Number(env.GENERATION_TIMEOUT_MS ?? '10000');
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
  throw new Error('Укажите положительное целое GENERATION_TIMEOUT_MS в миллисекундах.');
}

function createHttpApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  if (logTransportResponses) {
    app.post('/api/receive', (request, response, next) => {
      response.once('finish', () => {
        const body = JSON.stringify(request.body) ?? '(нет разобранного JSON)';
        console.log(`[POST /api/receive] HTTP ${response.statusCode} ${body}`);
      });
      next();
    });
  }
  app.use(express.json({ limit: '64kb' }));
  app.post('/api/receive', receiveOutlineResult);
  return app;
}

const app = createHttpApp();
app.use(session({
  name: SESSION_COOKIE,
  secret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' },
}));
app.use('/api', sessionRoutes(users), outlineRoutes(transportUrl.href, timeoutMs));

const specPath = new URL('./openapi.yaml', import.meta.url);
const spec = parse(readFileSync(specPath, 'utf8'));

app.use('/api', swaggerUi.serve);
app.get('/api', swaggerUi.setup(spec, {
  swaggerOptions: { validatorUrl: null },
}));

const handleError: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') {
    response.status(400).json({ message: 'Некорректный JSON.' });
    return;
  }
  if (error.type === 'entity.too.large') {
    response.status(413).json({ message: 'Слишком большой запрос.' });
    return;
  }
  console.error(error);
  response.status(500).json({ message: 'Ошибка сервера.' });
};
app.use(handleError);

app.listen(port, '127.0.0.1', (error) => {
  if (error) throw error;
  console.log(`Прикладной сервер: http://127.0.0.1:${port}`);
});

if (receiveHost && receiveHost !== '127.0.0.1') {
  const receiver = createHttpApp();
  receiver.use(handleError);
  receiver.listen(port, receiveHost, (error) => {
    if (error) throw error;
    console.log(`Внешний Receive: http://${receiveHost}:${port}/api/receive`);
  });
}
