import { useEffect, useRef, useState } from 'react';
import { Alert, Button } from '@mui/material';
import { apiErrorMessage, getSession, logout } from './api/appApi.ts';
import { LoginPage } from './pages/LoginPage.tsx';
import { OutlinePage } from './pages/OutlinePage.tsx';
import type { User } from './shared/contracts.ts';
import { clearOutline } from './state/outlineSlice.ts';
import { useAppDispatch } from './state/store.ts';

export function App() {
  const dispatch = useAppDispatch();
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const loginInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    getSession(controller.signal)
      .then((activeUser) => {
        if (!controller.signal.aborted) setUser(activeUser);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setCheckingSession(false);
      });
    return () => controller.abort();
  }, []);

  async function handleSessionAction() {
    if (!user) {
      loginInput.current?.focus();
      return;
    }

    setLoggingOut(true);
    setLogoutError('');
    try {
      await logout();
      dispatch(clearOutline());
      setUser(null);
    } catch (error) {
      setLogoutError(apiErrorMessage(error, 'Не удалось выйти. Попробуйте ещё раз.'));
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Создание структуры документа</h1>
        {!checkingSession && (
          <div className="session-actions">
            <span className="session-user">Пользователь: {user?.name ?? '—'}</span>
            <Button className="app-button session-button" disabled={loggingOut} onClick={handleSessionAction}>
              {user ? 'Выйти' : 'Войти'}
            </Button>
          </div>
        )}
      </header>

      <main className="workspace">
        {checkingSession ? (
          <div className="session-loading" role="status" aria-label="Проверка сессии">
            <span className="loading-spinner" aria-hidden="true" />
          </div>
        ) : user ? (
          <>
            {logoutError && <Alert className="app-alert logout-alert" severity="error">{logoutError}</Alert>}
            <OutlinePage author={user.name} loggingOut={loggingOut} />
          </>
        ) : (
          <LoginPage onLogin={setUser} loginInput={loginInput} />
        )}
      </main>
    </div>
  );
}
