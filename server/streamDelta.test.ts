import { describe, it, expect } from 'vitest';
import { extractAnthropicDelta, extractGoogleDelta } from './streamDelta';

describe('extractAnthropicDelta', () => {
  it('content_block_delta의 text_delta에서 텍스트를 꺼낸다', () => {
    const data = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'const A' },
    });
    expect(extractAnthropicDelta(data)).toEqual({ text: 'const A', truncated: false, finished: false });
  });

  it('텍스트가 없는 이벤트(ping 등)는 빈 문자열을 반환한다', () => {
    expect(extractAnthropicDelta(JSON.stringify({ type: 'ping' }))).toEqual({
      text: '',
      truncated: false,
      finished: false,
    });
  });

  it('JSON이 아닌 data는 빈 문자열을 반환한다', () => {
    expect(extractAnthropicDelta('not json')).toEqual({ text: '', truncated: false, finished: false });
  });

  it('message_stop 이벤트는 정상 종료로 표시한다', () => {
    expect(extractAnthropicDelta(JSON.stringify({ type: 'message_stop' }))).toEqual({
      text: '',
      truncated: false,
      finished: true,
    });
  });

  it('overloaded_error는 503으로 매핑해 과부하 안내로 분류되게 한다', () => {
    const data = JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } });
    expect(extractAnthropicDelta(data)).toEqual({
      text: '',
      truncated: false,
      finished: false,
      error: 'Claude API error: 503',
    });
  });

  it('rate_limit_error는 429로 매핑한다', () => {
    const data = JSON.stringify({ type: 'error', error: { type: 'rate_limit_error' } });
    expect(extractAnthropicDelta(data).error).toBe('Claude API error: 429');
  });

  it('그 외 error 타입은 타입 이름을 그대로 담는다', () => {
    const data = JSON.stringify({ type: 'error', error: { type: 'api_error' } });
    expect(extractAnthropicDelta(data).error).toBe('Claude API error: api_error');
  });
});

describe('extractGoogleDelta', () => {
  it('candidates의 parts 텍스트를 이어붙여 꺼낸다', () => {
    const data = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'const ' }, { text: 'A' }] } }],
    });
    expect(extractGoogleDelta(data)).toEqual({ text: 'const A', truncated: false, finished: false });
  });

  it('finishReason이 MAX_TOKENS면 truncated로 표시한다', () => {
    const data = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'MAX_TOKENS' }],
    });
    expect(extractGoogleDelta(data)).toEqual({ text: 'x', truncated: true, finished: true });
  });

  it('finishReason이 STOP이면 정상 종료로 표시한다', () => {
    const data = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'STOP' }],
    });
    expect(extractGoogleDelta(data)).toEqual({ text: 'x', truncated: false, finished: true });
  });

  it('candidates가 없으면 빈 문자열을 반환한다', () => {
    expect(extractGoogleDelta(JSON.stringify({}))).toEqual({ text: '', truncated: false, finished: false });
  });

  it('스트림 도중 error 페이로드는 상태 코드가 담긴 error 문구로 반환한다', () => {
    const data = JSON.stringify({ error: { code: 503, message: 'overloaded', status: 'UNAVAILABLE' } });
    expect(extractGoogleDelta(data)).toEqual({
      text: '',
      truncated: false,
      finished: false,
      error: 'Gemini API error: 503',
    });
  });
});
