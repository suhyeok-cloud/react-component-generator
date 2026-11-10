// 이 서버는 로컬 개발용이다. 서버 env 키로 비용이 발생하므로 임의 웹페이지의 cross-origin 호출을 막는다.
// Origin 헤더가 없는 요청(curl, 서버 간 호출)은 브라우저 cross-origin 공격이 아니므로 허용한다.
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function isAllowedOrigin(origin: string | null): boolean {
  return origin === null || LOCAL_ORIGIN.test(origin);
}

/** 요청 Origin에 맞춘 CORS 헤더. 허용된 Origin만 그대로 반영한다(`*` 사용 안 함). */
export function buildCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (origin !== null && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }

  return headers;
}
