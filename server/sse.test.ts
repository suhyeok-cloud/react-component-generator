import { describe, it, expect } from 'vitest';
import { createSseParser, formatSseEvent } from './sse';

describe('createSseParser', () => {
  it('완성된 이벤트의 data 값을 반환한다', () => {
    const parser = createSseParser();
    expect(parser.push('data: {"a":1}\n\n')).toEqual(['{"a":1}']);
  });

  it('청크 경계에서 잘린 이벤트는 다음 청크와 합쳐서 반환한다', () => {
    const parser = createSseParser();
    expect(parser.push('data: {"a"')).toEqual([]);
    expect(parser.push(':1}\n\n')).toEqual(['{"a":1}']);
  });

  it('한 청크에 담긴 여러 이벤트를 모두 반환한다', () => {
    const parser = createSseParser();
    expect(parser.push('data: one\n\ndata: two\n\n')).toEqual(['one', 'two']);
  });

  it('CRLF 구분자도 처리한다', () => {
    const parser = createSseParser();
    expect(parser.push('data: one\r\n\r\n')).toEqual(['one']);
  });

  it('data 줄이 없는 이벤트(event:, 주석)는 무시한다', () => {
    const parser = createSseParser();
    expect(parser.push('event: ping\n\n: keep-alive\n\n')).toEqual([]);
  });

  it('CRLF가 청크 경계에서 쪼개져도 이벤트 경계를 인식한다', () => {
    const parser = createSseParser();
    expect(parser.push('data: one\r')).toEqual([]);
    expect(parser.push('\n\r')).toEqual([]);
    expect(parser.push('\n')).toEqual(['one']);
  });

  it('flush는 빈 줄 없이 끝난 마지막 이벤트를 반환한다', () => {
    const parser = createSseParser();
    parser.push('data: tail');
    expect(parser.flush()).toEqual(['tail']);
  });

  it('flush 후에는 버퍼가 비어 있다', () => {
    const parser = createSseParser();
    parser.push('data: tail');
    parser.flush();
    expect(parser.flush()).toEqual([]);
  });
});

describe('formatSseEvent', () => {
  it('객체를 data 줄 하나로 직렬화하고 빈 줄로 끝낸다', () => {
    expect(formatSseEvent({ type: 'delta', text: 'hi' })).toBe('data: {"type":"delta","text":"hi"}\n\n');
  });
});
