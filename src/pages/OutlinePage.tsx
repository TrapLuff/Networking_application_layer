import { OutlineResult } from '../components/OutlineResult.tsx';
import { TopicForm } from '../components/TopicForm.tsx';
import { useOutlineEvents } from '../hooks/useOutlineEvents.ts';
import { requestOutline } from '../state/outlineSlice.ts';
import { useAppDispatch, useAppSelector } from '../state/store.ts';

export function OutlinePage({ author, loggingOut }: { author: string; loggingOut: boolean }) {
  const dispatch = useAppDispatch();
  const connection = useOutlineEvents();
  const status = useAppSelector((state) => state.outline.status);
  const busy = status === 'sending' || status === 'waiting';

  return (
    <>
      <TopicForm
        disabled={loggingOut || busy || connection !== 'open'}
        onSubmit={(topic) => void dispatch(requestOutline(topic))}
      />
      {connection !== 'open' && !loggingOut && (
        <p className="connection-status" role="status">
          {connection === 'closed'
            ? 'Поток результатов закрыт. Обновите страницу.'
            : 'Подключаемся к потоку результатов…'}
        </p>
      )}
      <OutlineResult author={author} />
    </>
  );
}
