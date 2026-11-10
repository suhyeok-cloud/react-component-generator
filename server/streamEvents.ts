import { stripCodeFences, ensureRenderCall } from './generator';
import { classifyError } from './errors';
import type { StreamDelta } from './streamDelta';

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string };

/**
 * 프로바이더 델타 스트림을 클라이언트용 이벤트 스트림으로 바꾼다.
 * 정상 종료 신호를 받은 경우에만 전체 텍스트를 `ensureRenderCall(stripCodeFences(text))`로
 * 후처리해 done으로 보낸다. 그 외(에러, 잘림, 끊김)는 error로 끝낸다.
 */
export async function* buildStreamEvents(source: AsyncIterable<StreamDelta>): AsyncGenerator<StreamEvent> {
  let text = '';
  let finished = false;

  try {
    for await (const delta of source) {
      if (delta.error) {
        yield { type: 'error', error: classifyError(delta.error).message };
        return;
      }
      if (delta.text) {
        text += delta.text;
        yield { type: 'delta', text: delta.text };
      }
      if (delta.truncated) {
        yield { type: 'error', error: '생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.' };
        return;
      }
      if (delta.finished) finished = true;
    }
  } catch (err) {
    yield { type: 'error', error: classifyError(err).message };
    return;
  }

  if (!finished) {
    yield { type: 'error', error: '응답이 중간에 끊겼습니다. 다시 시도해주세요.' };
    return;
  }

  // 안전 필터 등으로 텍스트 없이 종료된 경우 빈 컴포넌트가 저장되지 않게 막는다.
  if (!text.trim()) {
    yield { type: 'error', error: '생성된 응답이 비어 있습니다. 다시 시도해주세요.' };
    return;
  }

  yield { type: 'done', code: ensureRenderCall(stripCodeFences(text)) };
}
