import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, InputBase } from '@mui/material';
import { MAX_TOPIC_LENGTH } from '../shared/contracts.ts';

interface TopicFormProps {
  disabled?: boolean;
  onSubmit?: (topic: string) => void;
}

export function TopicForm({ disabled, onSubmit }: TopicFormProps) {
  const [topic, setTopic] = useState('');
  const trimmedTopic = topic.trim();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (trimmedTopic && !disabled) onSubmit?.(trimmedTopic);
  }

  return (
    <form className="topic-form" onSubmit={submit}>
      <InputBase
        className="topic-input"
        placeholder="Введите тему документа"
        inputProps={{ 'aria-label': 'Тема документа', maxLength: MAX_TOPIC_LENGTH }}
        value={topic}
        disabled={disabled}
        onChange={(event) => setTopic(event.target.value)}
      />
      <Button className="app-button topic-button" type="submit" disabled={disabled || !trimmedTopic}>
        Сгенерировать
      </Button>
    </form>
  );
}
