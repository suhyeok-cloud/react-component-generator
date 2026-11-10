import { describe, it, expect } from 'vitest';
import { validatePrompt, MAX_PROMPT_LENGTH } from './promptValidation';

describe('validatePrompt', () => {
  it('500자 이하면 유효하고 글자 수를 돌려준다', () => {
    const result = validatePrompt('가'.repeat(MAX_PROMPT_LENGTH));

    expect(result.valid).toBe(true);
    expect(result.length).toBe(500);
    expect(result.error).toBeUndefined();
  });

  it('501자부터는 무효이고 에러 메시지를 돌려준다', () => {
    const result = validatePrompt('가'.repeat(MAX_PROMPT_LENGTH + 1));

    expect(result.valid).toBe(false);
    expect(result.length).toBe(501);
    expect(result.error).toBe('프롬프트는 500자 이하로 입력해주세요. (현재 501자)');
  });

  it('앞뒤 공백은 글자 수에서 제외한다', () => {
    const result = validatePrompt(`  ${'가'.repeat(MAX_PROMPT_LENGTH)}  \n`);

    expect(result.valid).toBe(true);
    expect(result.length).toBe(500);
  });
});
