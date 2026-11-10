import { describe, it, expect } from 'vitest';
import { validateGenerateRequest, isProvider, MAX_PROMPT_LENGTH } from './validation';

describe('validateGenerateRequest', () => {
  it('키가 없으면 anthropic은 ANTHROPIC_API_KEY 안내를 반환한다', () => {
    expect(validateGenerateRequest('안녕', null, 'anthropic')).toBe(
      'API key is required. Set ANTHROPIC_API_KEY in .env or enter it manually.',
    );
  });

  it('키가 없으면 google은 GOOGLE_API_KEY 안내를 반환한다', () => {
    expect(validateGenerateRequest('안녕', null, 'google')).toBe(
      'API key is required. Set GOOGLE_API_KEY in .env or enter it manually.',
    );
  });

  it('프롬프트가 비어 있으면 Prompt is required를 반환한다', () => {
    expect(validateGenerateRequest('', 'key', 'google')).toBe('Prompt is required');
  });

  it('프롬프트가 undefined여도 Prompt is required를 반환한다', () => {
    expect(validateGenerateRequest(undefined, 'key', 'google')).toBe('Prompt is required');
  });

  it('키와 프롬프트가 모두 없으면 키 안내를 먼저 반환한다', () => {
    expect(validateGenerateRequest('', null, 'google')).toBe(
      'API key is required. Set GOOGLE_API_KEY in .env or enter it manually.',
    );
  });

  it('프롬프트가 문자열이 아니면 거부한다', () => {
    expect(validateGenerateRequest({ a: 1 }, 'key', 'google')).toBe('Prompt must be a string');
  });

  it('프롬프트가 길이 상한을 넘으면 거부한다', () => {
    expect(validateGenerateRequest('a'.repeat(MAX_PROMPT_LENGTH + 1), 'key', 'google')).toBe(
      `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)`,
    );
  });

  it('길이 상한과 같은 프롬프트는 허용한다', () => {
    expect(validateGenerateRequest('a'.repeat(MAX_PROMPT_LENGTH), 'key', 'google')).toBeNull();
  });

  it('키와 프롬프트가 모두 있으면 null을 반환한다', () => {
    expect(validateGenerateRequest('안녕', 'key', 'google')).toBeNull();
  });
});

describe('isProvider', () => {
  it('anthropic과 google만 허용한다', () => {
    expect(isProvider('anthropic')).toBe(true);
    expect(isProvider('google')).toBe(true);
  });

  it('알 수 없는 문자열은 거부한다', () => {
    expect(isProvider('openai')).toBe(false);
  });

  it('프로토타입 키(__proto__, constructor)는 거부한다', () => {
    expect(isProvider('__proto__')).toBe(false);
    expect(isProvider('constructor')).toBe(false);
  });

  it('문자열이 아니면 거부한다', () => {
    expect(isProvider(undefined)).toBe(false);
    expect(isProvider({})).toBe(false);
  });
});
