import { describe, it, expect } from 'vitest';
import { validateGenerateRequest } from './validation';

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

  it('키와 프롬프트가 모두 있으면 null을 반환한다', () => {
    expect(validateGenerateRequest('안녕', 'key', 'google')).toBeNull();
  });
});
