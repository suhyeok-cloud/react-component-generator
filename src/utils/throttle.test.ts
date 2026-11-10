import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLatestThrottle } from './throttle';

describe('createLatestThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('간격 안에 여러 번 push해도 최신 값으로 한 번만 호출한다', () => {
    const fn = vi.fn();
    const throttle = createLatestThrottle(fn, 100);
    throttle.push('a');
    throttle.push('ab');
    throttle.push('abc');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn.mock.calls).toEqual([['abc']]);
  });

  it('간격이 지난 뒤의 push는 다시 호출된다', () => {
    const fn = vi.fn();
    const throttle = createLatestThrottle(fn, 100);
    throttle.push('a');
    vi.advanceTimersByTime(100);
    throttle.push('ab');
    vi.advanceTimersByTime(100);
    expect(fn.mock.calls).toEqual([['a'], ['ab']]);
  });

  it('flush는 대기 중인 최신 값을 즉시 호출하고 이후 타이머 호출은 없다', () => {
    const fn = vi.fn();
    const throttle = createLatestThrottle(fn, 100);
    throttle.push('a');
    throttle.push('ab');
    throttle.flush();
    expect(fn.mock.calls).toEqual([['ab']]);
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('대기 중인 값이 없으면 flush는 아무것도 호출하지 않는다', () => {
    const fn = vi.fn();
    createLatestThrottle(fn, 100).flush();
    expect(fn).not.toHaveBeenCalled();
  });
});
