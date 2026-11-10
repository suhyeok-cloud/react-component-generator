import { describe, it, expect } from 'vitest';
import { buildStreamEvents, type StreamEvent } from './streamEvents';
import type { StreamDelta } from './streamDelta';

const delta = (text: string, extra: Partial<StreamDelta> = {}): StreamDelta => ({
  text,
  truncated: false,
  finished: false,
  ...extra,
});

async function* source(...items: Array<StreamDelta | Error>): AsyncGenerator<StreamDelta> {
  for (const item of items) {
    if (item instanceof Error) throw item;
    yield item;
  }
}

async function collect(gen: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of gen) events.push(event);
  return events;
}

describe('buildStreamEvents', () => {
  it('텍스트가 있는 델타마다 delta 이벤트를 내보낸다', async () => {
    const events = await collect(buildStreamEvents(source(delta('const A'), delta(' = 1;', { finished: true }))));
    expect(events.slice(0, 2)).toEqual([
      { type: 'delta', text: 'const A' },
      { type: 'delta', text: ' = 1;' },
    ]);
  });

  it('빈 텍스트 델타는 이벤트로 내보내지 않는다', async () => {
    const events = await collect(buildStreamEvents(source(delta('', { finished: true }))));
    expect(events.some((e) => e.type === 'delta')).toBe(false);
  });

  it('마지막에 코드펜스 제거와 render 보정을 거친 done 이벤트를 내보낸다', async () => {
    const events = await collect(
      buildStreamEvents(source(delta('```jsx\nconst Card = () => null;\n```', { finished: true }))),
    );
    expect(events.at(-1)).toEqual({
      type: 'done',
      code: 'const Card = () => null;\n\nrender(<Card />);',
    });
  });

  it('잘린 응답이면 done 없이 error 이벤트로 끝낸다', async () => {
    const events = await collect(buildStreamEvents(source(delta('const A', { truncated: true, finished: true }))));
    expect(events.at(-1)).toEqual({
      type: 'error',
      error: '생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.',
    });
    expect(events.some((e) => e.type === 'done')).toBe(false);
  });

  it('소스가 예외를 던지면 분류된 메시지의 error 이벤트로 끝낸다', async () => {
    const events = await collect(buildStreamEvents(source(new Error('Gemini API error: 503'))));
    expect(events).toEqual([
      { type: 'error', error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.' },
    ]);
  });

  it('프로바이더가 스트림 도중 보낸 에러는 분류된 error 이벤트로 끝낸다', async () => {
    const events = await collect(
      buildStreamEvents(source(delta('const A'), delta('', { error: 'Gemini API error: 429' }))),
    );
    expect(events.at(-1)).toEqual({ type: 'error', error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
    expect(events.some((e) => e.type === 'done')).toBe(false);
  });

  it('정상 종료 신호 없이 스트림이 끝나면 done 없이 error 이벤트로 끝낸다', async () => {
    const events = await collect(buildStreamEvents(source(delta('const A'))));
    expect(events.at(-1)).toEqual({ type: 'error', error: '응답이 중간에 끊겼습니다. 다시 시도해주세요.' });
    expect(events.some((e) => e.type === 'done')).toBe(false);
  });
});
