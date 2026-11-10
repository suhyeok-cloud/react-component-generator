# server/AGENTS.md

## Module Context

Bun 런타임에서 동작하는 AI API 프록시. 프론트엔드는 Vite 프록시(`/api` -> 3002)로 접근한다. 루트 규칙은 `../AGENTS.md`를 따른다.

## Tech Stack & Constraints

- 외부 SDK 없이 전역 `fetch`로 프로바이더를 직접 호출한다. 근거: `index.ts:69`, `index.ts:101`, `package.json` dependencies에 AI SDK 없음. SDK를 추가하지 않는다.
- 환경변수는 `process.env.ANTHROPIC_API_KEY`, `process.env.GOOGLE_API_KEY`만 사용한다 (`index.ts:59-62`).
- 서버 코드는 브라우저 번들에 들어가지 않는다. `src/`에서 `server/`를 import하지 않는다.

## Implementation Patterns

- 프로바이더 호출 함수는 `callAnthropic`, `callGoogleModel` + `callGoogle` 패턴이다. 모델별 시도는 `withModelFallback(models, attempt)`로 감싼다 (`index.ts:134-136`).
- 응답 후처리는 `ensureRenderCall(stripCodeFences(text))` 순서를 지킨다 (`index.ts:188`).
- 모든 응답에 `CORS_HEADERS`를 붙인다 (`index.ts:51-55`). 새 응답 경로에서 누락하지 않는다.
- 순수 함수는 `generator.ts`/`fallback.ts`처럼 별도 파일에 두고 같은 이름의 `*.test.ts`를 옆에 둔다.

## Testing Strategy

- 실행: `bun run test` (루트에서). 서버 테스트도 vitest가 실행하며 `include`에 `server/**/*.test.ts`가 포함돼 있다 (`../vite.config.ts:20`).
- 스타일: `describe`/`it` 한국어 제목, 모킹은 `vi.fn` (`fallback.test.ts:5-13`).
- `index.ts`는 import하면 서버가 뜨므로 테스트에서 import하지 않는다.

## Local Golden Rules

- Do: 에러 메시지에 상태 코드를 `error: ${status}` 형식으로 포함한다. 상위 `catch`가 문자열로 503/429를 분류한다 (`index.ts:194`, `index.ts:201`).
- Do: 새로 던지는 에러 문구에 숫자 `503`/`429`가 우연히 포함되지 않게 한다. `includes` 매칭이라 오분류된다.
- Don't: `withModelFallback`의 개별 실패를 로그 없이 삼키는 동작을 "버그"로 고치지 말 것. 의도는 마지막 에러만 던지는 것이다 (`fallback.ts:2`, `fallback.ts:19`). 로깅 추가 시 키가 포함된 URL을 출력하지 않는다.
- Don't: 시스템 프롬프트(`index.ts:7-49`)의 출력 규칙을 완화하지 않는다. 미리보기 계약과 연결돼 있다 (루트 Hard Constraints 참조).
- Don't: `/api/config`에 키 값, 키 일부, 해시를 추가하지 않는다 (`index.ts:147-157`).
- Don't: Google 모델 순서(`GOOGLE_MODELS`, `index.ts:5`)를 임의로 바꾸지 않는다. 앞쪽이 우선 시도되고 실패 시에만 다음으로 간다.
