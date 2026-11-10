/**
 * 최신 값만 간격마다 한 번 전달한다. 스트리밍 중 잦은 상태 갱신으로 인한 리렌더를 줄이는 용도다.
 * 마지막 값이 누락되지 않도록 끝날 때 flush를 호출해야 한다.
 */
export function createLatestThrottle<T>(
  fn: (value: T) => void,
  intervalMs: number,
): { push: (value: T) => void; flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { value: T } | null = null;

  const deliver = () => {
    if (!pending) return;
    const { value } = pending;
    pending = null;
    fn(value);
  };

  return {
    push(value) {
      pending = { value };
      if (timer === undefined) {
        timer = setTimeout(() => {
          timer = undefined;
          deliver();
        }, intervalMs);
      }
    },

    flush() {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      deliver();
    },
  };
}
