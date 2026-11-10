// 프로바이더 에러 메시지(`... error: ${status}`)를 HTTP 상태와 사용자 안내 문구로 분류한다.
// 문자열 매칭이므로 새 에러 문구에 503/429 숫자가 우연히 들어가지 않게 주의한다.
export function classifyError(message: string): { status: number; message: string } {
  if (message.includes('503')) {
    return { status: 503, message: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.' };
  }
  if (message.includes('429')) {
    return { status: 429, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' };
  }
  return { status: 500, message };
}
