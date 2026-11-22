import { useEffect, useState } from 'react';
import { isOutlineEvent } from '../shared/contracts.ts';
import { connectionLost, outlineReceived } from '../state/outlineSlice.ts';
import { useAppDispatch } from '../state/store.ts';

type ConnectionState = 'connecting' | 'open' | 'reconnecting' | 'closed';

export function useOutlineEvents() {
  const dispatch = useAppDispatch();
  const [connection, setConnection] = useState<ConnectionState>('connecting');

  useEffect(() => {
    const source = new EventSource('/api/events');

    source.onopen = () => setConnection('open');
    source.onerror = () => {
      setConnection(source.readyState === EventSource.CLOSED ? 'closed' : 'reconnecting');
      dispatch(connectionLost());
    };
    const onOutline = (message: MessageEvent<string>) => {
      try {
        const event: unknown = JSON.parse(message.data);
        if (isOutlineEvent(event)) dispatch(outlineReceived(event));
      } catch {
        // The stream is still usable if an individual frame is invalid.
      }
    };
    source.addEventListener('outline', onOutline);

    return () => {
      source.onopen = null;
      source.onerror = null;
      source.removeEventListener('outline', onOutline);
      source.close();
    };
  }, [dispatch]);

  return connection;
}
