import { describe, it, expect, vi } from 'vitest';
import { consumeGenerateStream } from './generateStream';

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
}

const event = (e: object) => `data: ${JSON.stringify(e)}\n\n`;

describe('consumeGenerateStream', () => {
  it('delta마다 누적된 코드를 onProgress로 전달한다', async () => {
    const onProgress = vi.fn();
    await consumeGenerateStream(
      sseResponse([
        event({ type: 'delta', text: 'const A' }),
        event({ type: 'delta', text: ' = 1;' }),
        event({ type: 'done', code: 'const A = 1;' }),
      ]),
      onProgress,
    );
    expect(onProgress.mock.calls).toEqual([['const A'], ['const A = 1;']]);
  });

  it('done 이벤트의 최종 코드를 반환한다', async () => {
    const code = await consumeGenerateStream(
      sseResponse([event({ type: 'delta', text: 'x' }), event({ type: 'done', code: 'final' })]),
      vi.fn(),
    );
    expect(code).toBe('final');
  });

  it('청크 경계에서 잘린 이벤트도 합쳐서 처리한다', async () => {
    const full = event({ type: 'done', code: 'ok' });
    const code = await consumeGenerateStream(sseResponse([full.slice(0, 10), full.slice(10)]), vi.fn());
    expect(code).toBe('ok');
  });

  it('error 이벤트를 받으면 그 메시지로 에러를 던진다', async () => {
    await expect(
      consumeGenerateStream(sseResponse([event({ type: 'error', error: '잘렸습니다' })]), vi.fn()),
    ).rejects.toThrow('잘렸습니다');
  });

  it('CRLF가 청크 경계에서 쪼개져도 이벤트를 처리한다', async () => {
    const code = await consumeGenerateStream(
      sseResponse(['data: {"type":"done","code":"ok"}\r', '\n\r', '\n']),
      vi.fn(),
    );
    expect(code).toBe('ok');
  });

  it('빈 줄 없이 끝난 마지막 done 이벤트도 처리한다', async () => {
    const code = await consumeGenerateStream(sseResponse(['data: {"type":"done","code":"ok"}']), vi.fn());
    expect(code).toBe('ok');
  });

  it('해석할 수 없는 data는 파싱 에러 원문 대신 안내 메시지로 에러를 던진다', async () => {
    await expect(consumeGenerateStream(sseResponse(['data: <html>\n\n']), vi.fn())).rejects.toThrow(
      '서버 응답을 해석할 수 없습니다',
    );
  });

  it('에러 이벤트로 끝나면 서버 연결(스트림)을 취소한다', async () => {
    const cancel = vi.fn();
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(event({ type: 'error', error: '실패' })));
      },
      cancel,
    });

    await expect(consumeGenerateStream(new Response(body), vi.fn())).rejects.toThrow('실패');
    expect(cancel).toHaveBeenCalled();
  });

  it('done 없이 스트림이 끝나면 에러를 던진다', async () => {
    await expect(
      consumeGenerateStream(sseResponse([event({ type: 'delta', text: 'x' })]), vi.fn()),
    ).rejects.toThrow('응답이 중간에 끊겼습니다');
  });
});
