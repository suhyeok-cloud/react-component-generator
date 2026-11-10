import { useState, useCallback, useEffect, useRef } from 'react';
import type { GeneratedComponent, Provider } from '../types';
import {
  addToHistory,
  loadComponents,
  loadHistory,
  saveComponents,
  saveHistory,
} from '../utils/storage';
import { consumeGenerateStream } from '../utils/generateStream';
import { createLatestThrottle } from '../utils/throttle';

// 스트리밍 코드 화면 갱신 간격(ms). 너무 길면 "실시간" 느낌이 줄고, 너무 짧으면 리렌더가 잦다.
const STREAM_RENDER_INTERVAL_MS = 80;

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
  const inFlightRef = useRef(false);

  useEffect(() => {
    saveComponents(localStorage, components);
  }, [components]);

  useEffect(() => {
    saveHistory(localStorage, history);
  }, [history]);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    // 진행 중인 생성이 있으면 무시한다. 두 스트림이 같은 상태(streaming, isLoading)를 덮어쓰지 않게 한다.
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setIsLoading(true);
    setError(null);

    setStreaming({ prompt, code: '' });

    // 델타마다 상태를 갱신하면 App과 모든 카드가 매번 리렌더되므로 최신 코드만 간격마다 반영한다.
    const progress = createLatestThrottle(
      (partial: string) => setStreaming({ prompt, code: partial }),
      STREAM_RENDER_INTERVAL_MS,
    );

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

      const code = await consumeGenerateStream(res, progress.push);

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
      // 대기 중인 타이머가 정리 뒤에 streaming을 되살리지 못하게 먼저 비운다(같은 배치에서 null이 마지막에 적용된다).
      progress.flush();
      setStreaming(null);
      setIsLoading(false);
      inFlightRef.current = false;
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
