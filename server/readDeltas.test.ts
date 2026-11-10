import { describe, it, expect } from 'vitest';
import { readDeltas } from './readDeltas';
import type { StreamDelta } from './streamDelta';

function responseOf(chunks: Uint8Array[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Response(body);
}

const encode = (text: string) => new TextEncoder().encode(text);
const extract = (data: string): StreamDelta => ({ text: data, truncated: false, finished: false });

async function collect(gen: AsyncIterable<StreamDelta>): Promise<string[]> {
  const texts: string[] = [];
  for await (const delta of gen) texts.push(delta.text);
  return texts;
}

describe('readDeltas', () => {
  it('SSE 이벤트마다 extract한 델타를 내보낸다', async () => {
    const response = responseOf([encode('data: a\n\ndata: b\n\n')]);
    expect(await collect(readDeltas(response, extract))).toEqual(['a', 'b']);
  });

  it('청크 경계에서 잘린 멀티바이트 문자를 깨뜨리지 않는다', async () => {
    const bytes = encode('data: 가\n\n');
    // '가'(3바이트)의 중간에서 청크를 자른다.
    const response = responseOf([bytes.slice(0, 7), bytes.slice(7)]);
    expect(await collect(readDeltas(response, extract))).toEqual(['가']);
  });

  it('스트림이 빈 줄 없이 끝나도 마지막 이벤트를 내보낸다', async () => {
    const response = responseOf([encode('data: a\n\ndata: tail')]);
    expect(await collect(readDeltas(response, extract))).toEqual(['a', 'tail']);
  });
});
