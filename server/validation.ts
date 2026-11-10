export const MAX_PROMPT_LENGTH = 10000;

/** 알려진 provider인지 확인한다. `__proto__` 같은 프로토타입 키가 env 키 조회를 속이지 못하게 막는다. */
export function isProvider(value: unknown): value is 'anthropic' | 'google' {
  return value === 'anthropic' || value === 'google';
}

// /api/generate 계열 요청의 공통 검증. 문제가 없으면 null, 있으면 에러 메시지를 반환한다.
export function validateGenerateRequest(
  prompt: unknown,
  resolvedKey: string | null,
  provider: 'anthropic' | 'google',
): string | null {
  if (!resolvedKey) {
    return `API key is required. Set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY'} in .env or enter it manually.`;
  }
  if (!prompt) {
    return 'Prompt is required';
  }
  if (typeof prompt !== 'string') {
    return 'Prompt must be a string';
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)`;
  }
  return null;
}
