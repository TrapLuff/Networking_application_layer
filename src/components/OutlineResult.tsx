import { Alert } from '@mui/material';
import { parseOutline } from '../outline/parseOutline.ts';
import { useAppSelector } from '../state/store.ts';

const dateFormat = new Intl.DateTimeFormat('ru', { dateStyle: 'short', timeStyle: 'medium' });

export function OutlineResult({ author }: { author: string }) {
  const state = useAppSelector((store) => store.outline);
  if (state.status === 'idle') return null;

  const waiting = state.status === 'waiting' || state.status === 'sending';
  const result = state.status === 'sending' ? undefined : state.result;
  if (waiting && !result) {
    return (
      <div className="outline-waiting" role="status">
        <span className="loading-spinner" aria-hidden="true" />
        Генерируем структуру…
      </div>
    );
  }

  const sections = result ? parseOutline(result.payload) : [];
  const date = result ? new Date(result.timestamp) : null;
  const progress = result?.progress;
  const errorMessage = state.status === 'error' ? state.message : undefined;
  const formatError = state.status === 'success' && sections.length === 0;
  const showProgress = progress && (waiting || state.status === 'error');

  return (
    <section className="outline-result" aria-label="Структура документа">
      {(date || showProgress) && (
        <div className="outline-meta">
          {date && <span>{author} · <time dateTime={date.toISOString()}>{dateFormat.format(date)}</time></span>}
          {showProgress && (
            <span className="outline-count" role="status">
              Получено частей: {progress.received} из {progress.total}
            </span>
          )}
        </div>
      )}
      <div className="outline-grid">
        {sections.map(({ number, title, subsections }) => (
          <article className="outline-card" key={number}>
            <h2 className="outline-card-title">{number}. {title}</h2>
            {subsections.length > 0 && (
              <ul className="outline-subsections">
                {subsections.map((item) => (
                  <li key={item.number}>{item.number}. {item.title}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
        {(errorMessage || formatError) && (
          <Alert className="app-alert outline-card outline-error" severity="error">
            <h2 className="outline-card-title">Ошибка получения данных</h2>
            <p>{errorMessage ?? 'В ответе нет нумерованных разделов.'}</p>
          </Alert>
        )}
      </div>
    </section>
  );
}
