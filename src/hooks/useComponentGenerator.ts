import { useState, useCallback, useEffect } from 'react';
import type { GeneratedComponent, Provider } from '../types';
import {
  addToHistory,
  loadComponents,
  loadHistory,
  saveComponents,
  saveHistory,
} from '../utils/storage';
import { consumeGenerateStream } from '../utils/generateStream';

interface StreamingState {
  prompt: string;
  code: string;
}

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  history: string[];
  isLoading: boolean;
  streaming: StreamingState | null;
  error: string | null;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
  clearHistory: () => void;
  exportToGist: (component: GeneratedComponent) => Promise<string | null>;
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [components, setComponents] = useState<GeneratedComponent[]>(() => loadComponents(localStorage));
  const [history, setHistory] = useState<string[]>(() => loadHistory(localStorage));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<StreamingState | null>(null);

  useEffect(() => {
    saveComponents(localStorage, components);
  }, [components]);

  useEffect(() => {
    saveHistory(localStorage, history);
  }, [history]);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    setIsLoading(true);
    setError(null);

    setStreaming({ prompt, code: '' });

    try {
      const res = await fetch('/api/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
      });

      if (!res.ok) {
        // 프록시가 HTML 에러 페이지를 돌려주는 경우 JSON 파싱이 실패하므로 기본 메시지로 대체한다.
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate component');
      }

      const code = await consumeGenerateStream(res, (partial) => setStreaming({ prompt, code: partial }));

      const newComponent: GeneratedComponent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        prompt,
        code,
        createdAt: new Date(),
      };

      setComponents((prev) => [newComponent, ...prev]);
      setHistory((prev) => addToHistory(prev, prompt));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setStreaming(null);
      setIsLoading(false);
    }
  }, []);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const exportToGist = useCallback(async (component: GeneratedComponent) => {
    setError(null);

    try {
      const res = await fetch('/api/gist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: component.prompt, code: component.code }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create gist');
      }

      return data.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  return { components, history, isLoading, streaming, error, generate, removeComponent, clearAll, clearHistory, exportToGist };
}
