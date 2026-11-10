import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';

function sseResponse(events: object[], init?: ResponseInit): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' }, ...init });
}

describe('useComponentGenerator', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('생성이 성공하면 컴포넌트를 추가하고 streaming 상태를 정리한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          { type: 'delta', text: 'const A' },
          { type: 'delta', text: ' = 1;' },
          { type: 'done', code: 'const A = 1;' },
        ]),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    expect(result.current.components[0]).toMatchObject({ prompt: '버튼', code: 'const A = 1;' });
    expect(result.current.streaming).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('생성 중에 generate를 다시 호출하면 무시한다(중복 요청 방지)', async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useComponentGenerator());

    let first: Promise<void> | undefined;
    await act(async () => {
      first = result.current.generate('첫 번째', undefined, 'google');
      await result.current.generate('두 번째', undefined, 'google');
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch?.(sseResponse([{ type: 'done', code: 'const A = 1;' }]));
      await first;
    });
    expect(result.current.components).toHaveLength(1);
    expect(result.current.components[0].prompt).toBe('첫 번째');
  });

  it('서버가 JSON 에러로 응답하면 error를 설정하고 streaming 상태를 정리한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: 'Prompt is required' }, { status: 400 })),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    expect(result.current.error).toBe('Prompt is required');
    expect(result.current.components).toEqual([]);
    expect(result.current.streaming).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('프록시가 JSON이 아닌 에러를 돌려주면 기본 메시지를 보여준다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 })));
    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    expect(result.current.error).toBe('Failed to generate component');
    expect(result.current.streaming).toBeNull();
  });

  it('스트림이 error 이벤트로 끝나면 컴포넌트를 저장하지 않고 streaming 상태를 정리한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          { type: 'delta', text: 'const A' },
          { type: 'error', error: '생성된 응답이 비어 있습니다. 다시 시도해주세요.' },
        ]),
      ),
    );
    const { result } = renderHook(() => useComponentGenerator());

    await act(async () => {
      await result.current.generate('버튼', undefined, 'google');
    });

    expect(result.current.error).toBe('생성된 응답이 비어 있습니다. 다시 시도해주세요.');
    expect(result.current.components).toEqual([]);
    expect(result.current.streaming).toBeNull();
  });
});
