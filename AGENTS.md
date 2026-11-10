# AGENTS.md

## Operational Commands

- 패키지 매니저는 bun 고정 (`bun.lock`). npm, yarn, pnpm 사용 금지.
- 설치: `bun install`
- 개발 서버(API 3002 + Vite 5173 동시): `bun run dev`
- API 서버만: `bun run server`
- 테스트: `bun run test` (단발), `bun run test:watch`
- 린트: `bun run lint`
- 빌드(타입 체크 포함): `bun run build`
- 변경 후 검증 순서: `bun run lint` -> `bun run test` -> `bun run build`
- `bun test` 사용 금지. Bun 자체 러너가 실행되어 vitest 설정(jsdom, `src/test/setup.ts`)이 적용되지 않는다. 근거: `vite.config.ts:16-21`, `package.json:12`.

## Golden Rules

### Immutable

- API 키 값을 응답, 로그, 에러 메시지, 클라이언트 코드로 내보내지 않는다. `/api/config`는 키 존재 여부(boolean)만 반환한다. 근거: `server/index.ts:59-62`, `server/index.ts:147-157`.
- `.env`는 읽어서 출력하거나 커밋하지 않는다. 근거: `.gitignore:32`.
- 민감 파일 차단: `.env*`, `*credential*`, `*secret*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa*`, `id_ed25519*`, `.npmrc`, `.netrc`, `.aws/`, `.ssh/`, `.gnupg/`, `service-account*.json`은 읽기·수정·복사·이동·삭제를 모두 하지 않는다. `cat`, `Get-Content`, `grep` 등 셸 우회도 금지다. 근거: `.claude/settings.json`의 `permissions.deny`.
- 민감 파일이 필요해 보이면 접근하지 말고 사용자에게 필요한 값(존재 여부, 변수 이름)만 물어본다. `permissions.deny` 항목을 임의로 제거·완화하지 않는다. 새 민감 파일 유형이 생기면 `settings.json`과 이 목록을 함께 갱신한다.
- Google 호출은 API 키가 URL 쿼리에 포함된다 (`server/index.ts:99`). 이 URL이나 fetch 에러 객체 전체를 로그/응답에 넣지 않는다. 현재 에러는 `error: ${status}` 형태의 상태 코드만 노출한다 (`server/index.ts:112`).
- 클라이언트가 입력한 키는 서버로는 요청 본문으로만 전달한다. 서버는 키를 저장하지 않는다. 브라우저에서는 사용자 편의를 위해 `localStorage`(`rcg:apiKeys`, provider별)에 평문 저장한다 (`src/utils/storage.ts`). 이 키를 로그/URL/다른 저장소로 내보내지 않는다. 근거: `src/hooks/useComponentGenerator.ts:61`.

### Hard Constraints

- 생성 코드 계약: 시스템 프롬프트(`server/index.ts:7-20`)의 "import 금지, 전역 React, 마지막에 `render(<Name />)`, TypeScript 문법 금지"는 `LivePreview`의 `noInline` 렌더링(`src/components/LivePreview.tsx:14`) 및 `ensureRenderCall`(`server/generator.ts:16`)과 한 세트다. 프롬프트나 렌더 방식을 바꿀 때는 세 곳을 함께 수정한다.
- 에러 분류는 메시지 문자열 매칭이다 (`message.includes('503')`, `'429'`, `server/index.ts:194`, `server/index.ts:201`). 프로바이더 에러 메시지는 `... error: ${status}` 형식을 유지해야 매핑이 동작한다 (`server/index.ts:85`, `server/index.ts:112`).
- API 포트 3002는 `server/index.ts:139`와 `vite.config.ts:11` 두 곳에 있다. 한쪽만 바꾸지 않는다.
- 프로바이더 추가/변경 시 `server/index.ts:57`(`Provider`), `server/index.ts:59`(`ENV_KEYS`), `src/types/index.ts:1`(`Provider`), `src/App.tsx:9`(`PROVIDER_CONFIG`)를 모두 맞춘다. 타입이 서버/클라이언트에 중복 정의되어 있다.

### Asymmetry

- 모델 폴백(`withModelFallback`)과 `MAX_TOKENS` 잘림 검사는 Google 경로에만 있다 (`server/index.ts:5`, `server/index.ts:123`, `server/index.ts:135`). Anthropic 경로(`server/index.ts:68-96`)에는 없고 `max_tokens`도 4096으로 Google의 8192(`server/index.ts:107`)와 다르다. 한 경로에만 있는 처리를 "누락"으로 단정해 맞추지 말고, 의도를 사용자에게 확인한 뒤 변경한다.

### Double Defense

- 코드 펜스: 프롬프트가 "no markdown fences"를 요구하고(`server/index.ts:16`) 서버도 `stripCodeFences`로 제거한다 (`server/generator.ts:4-10`, 호출 `server/index.ts:188`).
- render 호출: 프롬프트가 `render(...)`를 요구하고(`server/index.ts:12`) 서버가 `ensureRenderCall`로 보정한다 (`server/generator.ts:16-24`).
- 두 쌍 모두 한쪽만 제거하면 모델 응답이 흔들릴 때 미리보기가 깨진다. 어느 쪽도 삭제하지 않는다.

### Test Boundary

- 테스트 있음: `server/generator.ts`, `server/fallback.ts`, `src/components/PromptInput.tsx`.
- 테스트 없음: `server/index.ts`(import 시 `Bun.serve`가 실행됨, `server/index.ts:138`), `src/hooks/useComponentGenerator.ts`, `src/App.tsx`, `ComponentCard`, `LivePreview`, `CodeView`.
- 새 서버 로직은 `index.ts`에 직접 쓰지 말고 부수효과 없는 모듈로 분리해 테스트를 붙인다. 기존 분리 의도: `server/generator.ts:1-2`.

## Project Context

React 컴포넌트를 프롬프트로 생성하고 미리보기/코드를 보여주는 도구. 에이전트 규칙 외의 소개는 `README.md` 참조.

Tech Stack: React 19, TypeScript, Vite, Bun(API 프록시), react-live, vitest, ESLint.

## Standards & References

- 코딩 컨벤션: `eslint.config.js`를 따른다. 별도 문서 없음.
- 사용자에게 보이는 문자열, 코드 주석, 커밋 메시지는 한국어로 쓴다.
- 커밋: `.claude/skills/commit/SKILL.md` 절차를 따른다. 형식은 `feat|fix|refactor|chore: 한국어 요약`.
- Maintenance Policy: 이 문서의 규칙과 코드가 어긋난 것을 발견하면 작업을 멈추지 말고 끝에 AGENTS.md 업데이트를 제안한다.

## Context Map

- **[API 서버 수정 (Bun)](./server/AGENTS.md)** — 프로바이더 호출, 시스템 프롬프트, 에러 처리, 서버 테스트 작업 시.
- **[프론트엔드 UI 수정 (React)](./src/AGENTS.md)** — 컴포넌트, 레트로 테마 CSS, 미리보기, 프런트 테스트 작업 시.
