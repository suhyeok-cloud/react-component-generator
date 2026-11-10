import { describe, it, expect } from 'vitest';
import { createConcurrencyLimiter } from './limiter';

describe('createConcurrencyLimiter', () => {
  it('상한 이내에서는 release 함수를 반환한다', () => {
    const limiter = createConcurrencyLimiter(2);
    expect(limiter.acquire()).toBeTypeOf('function');
    expect(limiter.acquire()).toBeTypeOf('function');
  });

  it('상한을 넘으면 null을 반환한다', () => {
    const limiter = createConcurrencyLimiter(1);
    limiter.acquire();
    expect(limiter.acquire()).toBeNull();
  });

  it('release하면 다시 acquire할 수 있다', () => {
    const limiter = createConcurrencyLimiter(1);
    const release = limiter.acquire();
    release?.();
    expect(limiter.acquire()).toBeTypeOf('function');
  });

  it('같은 release를 여러 번 호출해도 한 번만 반납한다', () => {
    const limiter = createConcurrencyLimiter(1);
    const release = limiter.acquire();
    release?.();
    release?.();
    limiter.acquire();
    expect(limiter.acquire()).toBeNull();
  });
});
