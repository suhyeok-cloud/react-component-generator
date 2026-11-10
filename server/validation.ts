// /api/generate 계열 요청의 공통 검증. 문제가 없으면 null, 있으면 에러 메시지를 반환한다.
export function validateGenerateRequest(
  prompt: string | undefined,
  resolvedKey: string | null,
  provider: 'anthropic' | 'google',
): string | null {
  if (!resolvedKey) {
    return `API key is required. Set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY'} in .env or enter it manually.`;
  }
  if (!prompt) {
    return 'Prompt is required';
  }
  return null;
}
