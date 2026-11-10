import { describe, it, expect, vi } from 'vitest';
import { createSseStream } from './streamResponse';
import type { StreamEvent } from './streamEvents';

async function* events(...items: StreamEvent[]): AsyncGenerator<StreamEvent> {
  for (const item of items) yield item;
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return text;
    text += decoder.decode(value);
  }
}

describe('createSseStream', () => {
  it('이벤트를 SSE 형식으로 내보낸다', async () => {
    const stream = createSseStream(events({ type: 'delta', text: 'a' }, { type: 'done', code: 'a' }), vi.fn());
    expect(await readAll(stream)).toBe(
      'data: {"type":"delta","text":"a"}\n\ndata: {"type":"done","code":"a"}\n\n',
    );
  });

  it('끝까지 읽으면 onClose를 한 번 호출한다', async () => {
    const onClose = vi.fn();
    await readAll(createSseStream(events({ type: 'done', code: 'a' }), onClose));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('소비자가 취소하면 onClose를 호출한다', async () => {
    const onClose = vi.fn();
    const stream = createSseStream(events({ type: 'delta', text: 'a' }, { type: 'done', code: 'a' }), onClose);
    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('소비자가 취소하면 소스 제너레이터의 정리(finally)가 실행된다', async () => {
    const cleanup = vi.fn();
    async function* source(): AsyncGenerator<StreamEvent> {
      try {
        yield { type: 'delta', text: 'a' };
        yield { type: 'delta', text: 'b' };
      } finally {
        cleanup();
      }
    }
    const reader = createSseStream(source(), vi.fn()).getReader();
    await reader.read();
    await reader.cancel();
    expect(cleanup).toHaveBeenCalled();
  });

  it('소비자가 읽는 만큼만 소스를 당겨온다(backpressure)', async () => {
    const pulled = vi.fn();
    async function* source(): AsyncGenerator<StreamEvent> {
      for (let i = 0; i < 5; i++) {
        pulled();
        yield { type: 'delta', text: String(i) };
      }
    }
    const reader = createSseStream(source(), vi.fn()).getReader();
    await reader.read();
    await new Promise((resolve) => setTimeout(resolve, 0));
    // 초기 pull 1회 + 첫 read 이후 1회까지만 허용한다. 소스를 미리 다 소비하면 5회가 된다.
    expect(pulled.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('iterator.return이 reject해도 cancel은 실패하지 않고 onClose를 호출한다', async () => {
    const onClose = vi.fn();
    const source: AsyncIterable<StreamEvent> = {
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.resolve({ done: false, value: { type: 'delta', text: 'a' } as StreamEvent }),
        return: () => Promise.reject(new Error('return failed')),
      }),
    };
    const reader = createSseStream(source, onClose).getReader();
    await reader.read();
    await expect(reader.cancel()).resolves.toBeUndefined();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('next() 진행 중에 취소해도 onClose는 한 번만 호출된다', async () => {
    const onClose = vi.fn();
    let release: (() => void) | undefined;
    async function* source(): AsyncGenerator<StreamEvent> {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      yield { type: 'delta', text: 'late' };
    }
    const reader = createSseStream(source(), onClose).getReader();
    const pendingRead = reader.read();
    await reader.cancel();
    release?.();
    await pendingRead.catch(() => {});
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('소스가 예외를 던지면 스트림을 닫고 onClose를 호출한다', async () => {
    const onClose = vi.fn();
    async function* source(): AsyncGenerator<StreamEvent> {
      yield { type: 'delta', text: 'a' };
      throw new Error('boom');
    }
    const text = await readAll(createSseStream(source(), onClose));
    expect(text).toBe('data: {"type":"delta","text":"a"}\n\n');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
