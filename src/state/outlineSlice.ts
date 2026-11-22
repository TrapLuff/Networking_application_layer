import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { apiErrorMessage, generate } from '../api/appApi.ts';
import type { GenerateResponse, OutlineEvent } from '../shared/contracts.ts';

type OutlineResult = Extract<OutlineEvent, { error: false }>;
type WaitingState = { status: 'waiting'; timestamp: number; result?: OutlineResult };
type RequestState =
  | WaitingState
  | { status: 'success'; result: OutlineResult }
  | { status: 'error'; message: string; result?: OutlineResult };
type OutlineState =
  | { status: 'idle' }
  | { status: 'sending'; requestId: string; earlyEvents: OutlineEvent[] }
  | RequestState;

const initialState: OutlineState = { status: 'idle' };

export const requestOutline = createAsyncThunk<GenerateResponse, string, { rejectValue: string }>(
  'outline/request',
  async (topic, { rejectWithValue }) => {
    try {
      return await generate(topic);
    } catch (error) {
      return rejectWithValue(apiErrorMessage(error, 'Не удалось отправить тему. Попробуйте ещё раз.'));
    }
  },
);

function resultState(state: WaitingState, event: OutlineEvent): RequestState {
  if (!event.error) {
    const { progress } = event;
    if (progress && progress.received < progress.total) return { ...state, result: event };
    return { status: 'success', result: event };
  }

  if (state.result) {
    const message = event.reason === 'timeout'
      ? 'Оставшиеся части не поступили вовремя.'
      : 'Транспорт сообщил о потере части структуры.';
    return { status: 'error', message, result: state.result };
  }

  const message = event.reason === 'timeout'
    ? 'Транспорт не вернул результат вовремя. Попробуйте ещё раз.'
    : 'Не удалось собрать структуру документа.';
  return { status: 'error', message };
}

const outlineSlice = createSlice({
  name: 'outline',
  initialState: initialState as OutlineState,
  reducers: {
    clearOutline: () => initialState,
    outlineReceived: (state, { payload }: PayloadAction<OutlineEvent>) => {
      // A callback can arrive before the HTTP 202 reaches this tab.
      if (state.status === 'sending') state.earlyEvents.push(payload);
      if (state.status === 'waiting' && state.timestamp === payload.timestamp) {
        return resultState(state, payload);
      }
    },
    connectionLost: (state) => {
      if (state.status === 'sending' || state.status === 'waiting') {
        return {
          status: 'error',
          message: 'Соединение прервано. Отправьте тему ещё раз.',
          result: state.status === 'waiting' ? state.result : undefined,
        };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(requestOutline.pending, (_state, { meta }) => ({
        status: 'sending',
        requestId: meta.requestId,
        earlyEvents: [],
      }))
      .addCase(requestOutline.fulfilled, (state, { payload, meta }) => {
        if (state.status !== 'sending' || state.requestId !== meta.requestId) return;
        let next: RequestState = { status: 'waiting', timestamp: payload.timestamp };
        for (const event of state.earlyEvents) {
          if (next.status !== 'waiting') break;
          if (event.timestamp === payload.timestamp) next = resultState(next, event);
        }
        return next;
      })
      .addCase(requestOutline.rejected, (state, { payload, meta }) => {
        if (state.status !== 'sending' || state.requestId !== meta.requestId) return;
        return { status: 'error', message: payload ?? 'Не удалось отправить тему.' };
      });
  },
});

export const { clearOutline, outlineReceived, connectionLost } = outlineSlice.actions;
export default outlineSlice.reducer;
