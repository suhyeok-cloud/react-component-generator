/** 사용자에게 그대로 보여줘도 안전한, 서버가 의도해서 만든 안내 에러. */
export class UserFacingError extends Error {}

const GENERIC_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';

// 원문을 그대로 내보내도 되는 것은 두 가지뿐이다.
// - 프로바이더 에러: `Claude|Gemini API error: <상태/타입>` 형식(공백·한글 등이 섞이면 불일치)
// - UserFacingError: 서버가 의도해서 만든 안내 문구
// 그 외(JSON 파싱 오류, fetch 실패 등)는 URL·키 조각이 섞일 수 있어 일반 문구로 대체한다.
const PROVIDER_ERROR = /^(Claude|Gemini) API error: [\w.-]+$/;

// 프로바이더 에러 메시지(`... error: ${status}`)를 HTTP 상태와 사용자 안내 문구로 분류한다.
// 문자열 매칭이므로 새 에러 문구에 503/429 숫자가 우연히 들어가지 않게 주의한다.
export function classifyError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('503')) {
    return { status: 503, message: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.' };
  }
  if (message.includes('429')) {
    return { status: 429, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' };
  }
  if (error instanceof UserFacingError || PROVIDER_ERROR.test(message)) {
    return { status: 500, message };
  }
  return { status: 500, message: GENERIC_MESSAGE };
}
