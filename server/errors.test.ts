import { describe, it, expect } from 'vitest';
import { classifyError, UserFacingError } from './errors';

const GENERIC = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';

describe('classifyError', () => {
  it('503이 포함된 메시지는 과부하 안내로 분류한다', () => {
    expect(classifyError('Gemini API error: 503')).toEqual({
      status: 503,
      message: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('429가 포함된 메시지는 요청 과다 안내로 분류한다', () => {
    expect(classifyError('Claude API error: 429')).toEqual({
      status: 429,
      message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    });
  });

  it('알려진 프로바이더 에러 형식은 500과 원문을 그대로 반환한다', () => {
    expect(classifyError('Claude API error: 401')).toEqual({
      status: 500,
      message: 'Claude API error: 401',
    });
  });

  it('UserFacingError(서버가 의도한 안내)는 원문을 유지한다', () => {
    const message = '생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.';
    expect(classifyError(new UserFacingError(message))).toEqual({ status: 500, message });
  });

  it('한글이 섞인 프로바이더 문자열은 일반 문구로 대체한다', () => {
    expect(classifyError('Claude API error: foo bar 한글')).toEqual({ status: 500, message: GENERIC });
  });

  it('일반 Error 객체는 메시지로 분류한다', () => {
    expect(classifyError(new Error('Gemini API error: 503')).status).toBe(503);
  });

  it('일반 Error에 한글이 섞여 있어도 UserFacingError가 아니면 일반 문구로 대체한다', () => {
    expect(classifyError(new Error('알 수 없는 내부 오류 가나다'))).toEqual({ status: 500, message: GENERIC });
  });

  it('JSON 파싱 오류 같은 내부 예외는 일반 문구로 대체한다', () => {
    expect(classifyError('Unexpected token < in JSON at position 0')).toEqual({
      status: 500,
      message: GENERIC,
    });
  });

  it('fetch 실패 메시지는 일반 문구로 대체한다', () => {
    expect(classifyError('fetch failed')).toEqual({ status: 500, message: GENERIC });
  });

  it('키가 담긴 URL이 메시지에 있어도 응답에 노출하지 않는다', () => {
    const result = classifyError('Unable to connect: https://example.test/v1?key=SECRET-VALUE');
    expect(result.message).not.toContain('SECRET-VALUE');
  });
});
