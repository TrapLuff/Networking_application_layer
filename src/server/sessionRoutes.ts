import { Router } from 'express';
import type { User } from '../shared/contracts.ts';
import { cancelSessionGenerations } from './generationService.ts';
import { closeStreams } from './sseConnections.ts';

declare module 'express-session' {
  interface SessionData {
    user?: User;
  }
}

export const SESSION_COOKIE = 'outline.sid';

function endSession(sessionId: string) {
  cancelSessionGenerations(sessionId);
  closeStreams(sessionId);
}

export function sessionRoutes(users: User[]) {
  const router = Router();

  router.get('/session', (request, response) => {
    response.json({ user: request.session.user ?? null });
  });

  router.post('/login', (request, response, next) => {
    const { login } = request.body ?? {};
    if (typeof login !== 'string' || !login.trim()) {
      response.status(400).json({ message: 'Введите логин.' });
      return;
    }

    const user = users.find((account) => account.login === login.trim());
    if (!user) {
      response.status(401).json({ message: 'Неизвестный логин.' });
      return;
    }

    const previousSession = request.sessionID;
    request.session.regenerate((error) => {
      if (error) return next(error);

      endSession(previousSession);
      request.session.user = user;
      request.session.save((saveError) => {
        if (saveError) return next(saveError);
        response.json({ user });
      });
    });
  });

  router.post('/logout', (request, response, next) => {
    const sessionId = request.sessionID;
    request.session.destroy((error) => {
      if (error) return next(error);

      endSession(sessionId);
      response.clearCookie(SESSION_COOKIE);
      response.sendStatus(204);
    });
  });

  return router;
}
