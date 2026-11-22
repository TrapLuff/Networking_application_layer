import { useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import { Alert, Button, TextField } from '@mui/material';
import { apiErrorMessage, login } from '../api/appApi.ts';
import { TopicForm } from '../components/TopicForm.tsx';
import type { User } from '../shared/contracts.ts';

interface LoginPageProps {
  onLogin: (user: User) => void;
  loginInput: RefObject<HTMLInputElement | null>;
}

export function LoginPage({ onLogin, loginInput }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await login({ login: username }));
    } catch (cause) {
      setError(apiErrorMessage(cause, 'Не удалось связаться с сервером. Попробуйте ещё раз.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="login-preview" inert aria-hidden="true">
        <TopicForm disabled />
      </div>
      <div className="login-layout">
        <form className="login-form" onSubmit={submit} aria-labelledby="login-title">
          <h2 className="login-title" id="login-title">Вход</h2>
          <TextField
            className="login-field"
            inputRef={loginInput}
            id="login"
            label="Логин"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          {error && <Alert className="app-alert" severity="error">{error}</Alert>}
          <Button className="app-button login-button" type="submit" disabled={busy}>
            {busy ? 'Вход…' : 'Войти'}
          </Button>
        </form>
      </div>
    </>
  );
}
