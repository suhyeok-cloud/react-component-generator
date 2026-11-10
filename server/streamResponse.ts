import { formatSseEvent } from './sse';
import type { StreamEvent } from './streamEvents';

/**
 * 이벤트 스트림을 SSE 응답 본문으로 만든다.
 * pull 방식이라 소비자가 읽는 만큼만 소스를 당겨오고(backpressure),
 * 끝나거나 취소되거나 실패하면 onClose를 정확히 한 번 호출해 업스트림 정리와 슬롯 반납을 맡긴다.
 */
export function createSseStream(
  source: AsyncIterable<StreamEvent>,
  onClose: () => void,
): ReadableStream<Uint8Array> {
  const iterator = source[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    onClose();
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await iterator.next();
        if (done) {
          controller.close();
          close();
          return;
        }
        controller.enqueue(encoder.encode(formatSseEvent(value)));
      } catch {
        // 소스 오류이거나 이미 취소된 스트림이다. 닫을 수 있으면 닫고 정리만 한다.
        try {
          controller.close();
        } catch {
          // 이미 닫힘
        }
        close();
      }
    },

    async cancel() {
      try {
        close();
      } finally {
        try {
          await iterator.return?.();
        } catch {
          // 정리 중 오류는 취소를 실패시키지 않는다.
        }
      }
    },
  });
}
