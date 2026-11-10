/** 동시 실행 수를 제한한다. acquire가 null이면 상한 초과이고, 반환된 release는 여러 번 호출해도 한 번만 반납한다. */
export function createConcurrencyLimiter(max: number): { acquire: () => (() => void) | null } {
  let active = 0;

  return {
    acquire() {
      if (active >= max) return null;
      active++;

      let released = false;
      return () => {
        if (released) return;
        released = true;
        active--;
      };
    },
  };
}
