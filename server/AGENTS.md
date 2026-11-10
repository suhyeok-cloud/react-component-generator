# server/AGENTS.md

## Module Context

Bun 런타임에서 동작하는 AI API 프록시. 프론트엔드는 Vite 프록시(`/api` -> 3002)로 접근한다. 루트 규칙은 `../AGENTS.md`를 따른다.

## Tech Stack & Constraints

- 외부 SDK 없이 전역 `fetch`로 프로바이더를 직접 호출한다. 근거: `index.ts:69`, `index.ts:101`, `package.json` dependencies에 AI SDK 없음. SDK를 추가하지 않는다.
- 환경변수는 `process.env.ANTHROPIC_API_KEY`, `process.env.GOOGLE_API_KEY`, Gist 내보내기용 `process.env.GITHUB_TOKEN`만 사용한다. 토큰은 클라이언트로 보내거나 `/api/config`에 노출하지 않는다.
- `/api/gist`는 항상 비공개(secret) Gist를 만든다 (`gist.ts` `buildGistPayload`). 공개로 바꾸지 않는다. 에러에는 상태 코드만 담는다 (`GitHub API error: ${status}`).
- 서버 코드는 브라우저 번들에 들어가지 않는다. `src/`에서 `server/`를 import하지 않는다.

## Implementation Patterns

- 프로바이더 호출 함수는 `callAnthropic`, `callGoogleModel` + `callGoogle` 패턴이다. 모델별 시도는 `withModelFallback(models, attempt)`로 감싼다 (`index.ts:134-136`).
- 응답 후처리는 `ensureRenderCall(stripCodeFences(text))` 순서를 지킨다 (`index.ts:188`).
- 모든 응답에 요청별 `cors` 헤더(`buildCorsHeaders(origin)`)를 붙인다 (`index.ts` `fetch` 핸들러 시작부). 새 응답 경로에서 누락하지 않는다. 허용 Origin은 `localhost`/`127.0.0.1`뿐이고 `*`를 쓰지 않는다 (`cors.ts`). 서버는 `127.0.0.1`에만 바인딩한다.
- 스트리밍(`/api/generate/stream`): `readDeltas` → `buildStreamEvents` → `createSseStream` 순서로 흐른다. 프로바이더 `error`/잘림/종료 신호 없는 끊김/빈 응답은 `done` 대신 `error` 이벤트로 끝낸다. 동시 스트림은 `limiter.ts`로 제한하고, 스트림이 끝나거나 취소되면 `createSseStream`의 `onClose`에서 업스트림 `abort`와 슬롯 반납을 한다. 입력 검증은 `validation.ts`(`isProvider`, `validateGenerateRequest`)를 쓴다.
- 순수 함수는 `generator.ts`/`fallback.ts`처럼 별도 파일에 두고 같은 이름의 `*.test.ts`를 옆에 둔다.

## Testing Strategy

- 실행: `bun run test` (루트에서). 서버 테스트도 vitest가 실행하며 `include`에 `server/**/*.test.ts`가 포함돼 있다 (`../vite.config.ts:20`).
- 스타일: `describe`/`it` 한국어 제목, 모킹은 `vi.fn` (`fallback.test.ts:5-13`).
- `index.ts`는 import하면 서버가 뜨므로 테스트에서 import하지 않는다.

## Local Golden Rules

- Do: 에러 메시지에 상태 코드를 `error: ${status}` 형식으로 포함한다. 상위 `catch`가 문자열로 503/429를 분류한다 (`index.ts:194`, `index.ts:201`).
- Do: 새로 던지는 에러 문구에 숫자 `503`/`429`가 우연히 포함되지 않게 한다. `includes` 매칭이라 오분류된다.
- Do: 사용자에게 보이는 에러는 `Claude|Gemini API error: <상태/타입>` 형식이거나 한글 안내 문구여야 한다. 그 외 메시지(JSON 파싱 오류, fetch 실패 등)는 URL·키 조각 노출을 막으려고 `classifyError`가 일반 문구로 대체한다 (`errors.ts`).
- Don't: 스트리밍 경로에 Anthropic `max_tokens` 잘림 처리나 스트림 중 모델 폴백을 "누락"으로 단정해 추가하지 않는다. 폴백은 Google 연결 단계에만 있고, 잘림 검사는 Google 경로에만 있다. 의도를 사용자에게 확인한 뒤 변경한다.
- Don't: `withModelFallback`의 개별 실패를 로그 없이 삼키는 동작을 "버그"로 고치지 말 것. 의도는 마지막 에러만 던지는 것이다 (`fallback.ts:2`, `fallback.ts:19`). 로깅 추가 시 키가 포함된 URL을 출력하지 않는다.
- Don't: 시스템 프롬프트(`index.ts:7-49`)의 출력 규칙을 완화하지 않는다. 미리보기 계약과 연결돼 있다 (루트 Hard Constraints 참조).
- Don't: `/api/config`에 키 값, 키 일부, 해시를 추가하지 않는다 (`index.ts:147-157`).
- Don't: Google 모델 순서(`GOOGLE_MODELS`, `index.ts:5`)를 임의로 바꾸지 않는다. 앞쪽이 우선 시도되고 실패 시에만 다음으로 간다.
