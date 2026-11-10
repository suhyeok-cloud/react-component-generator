import { createSseParser } from './sse';
import type { StreamDelta } from './streamDelta';

/** 프로바이더 SSE 응답 본문을 읽어 이벤트마다 델타 조각으로 변환한다. */
export async function* readDeltas(
  response: Response,
  extract: (data: string) => StreamDelta,
): AsyncGenerator<StreamDelta> {
  const parser = createSseParser();
  const decoder = new TextDecoder();

  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    for (const data of parser.push(decoder.decode(chunk, { stream: true }))) {
      yield extract(data);
    }
  }

  for (const data of [...parser.push(decoder.decode()), ...parser.flush()]) {
    yield extract(data);
  }
}
