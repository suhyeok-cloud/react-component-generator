# src/AGENTS.md

## Module Context

Vite + React 19 프론트엔드. `/api/*`는 서버 프록시를 통해서만 호출한다. 루트 규칙은 `../AGENTS.md`를 따른다.

## Tech Stack & Constraints

- 스타일은 `App.css` 한 파일과 `index.css`(리셋, 바탕화면)로 관리한다. CSS 모듈, CSS-in-JS, UI 라이브러리를 추가하지 않는다.
- 미리보기는 `react-live`의 `LiveProvider noInline`을 사용한다 (`components/LivePreview.tsx:14`).
- 서버 통신은 `hooks/useComponentGenerator.ts` 한 곳에서 `fetch('/api/generate/stream')`로 한다. SSE 응답 해석은 `utils/generateStream.ts`의 `consumeGenerateStream`이 맡는다. 컴포넌트에서 직접 fetch하지 않는다. 예외: 키 보유 여부 조회 `/api/config` (`App.tsx`).
- 스트리밍 중 코드 갱신은 `utils/throttle.ts`로 묶어 반영한다. 끝날 때 `flush()`를 `setStreaming(null)`보다 먼저 호출해, 대기 중인 타이머가 정리 뒤에 `streaming`을 되살리지 않게 한다.

## Implementation Patterns

- 디자인 토큰은 `App.css` 상단 `:root` 변수(`--chrome`, `--marker`, `--bevel-out`, `--bevel-in` 등)를 쓴다. 새 색을 하드코딩하지 말고 변수를 추가한다.
- 창 형태의 패널은 `components/TitleBar.tsx`를 재사용한다. 모서리는 둥글게 하지 않는다(`border-radius` 사용 안 함), 입체감은 `--bevel-out`/`--bevel-in` 박스 섀도로 만든다.
- 버튼 클래스(`btn-*`, `tab`, `example-chip`)는 `App.css`에서 공통 규칙으로 묶여 있다. 새 버튼은 해당 묶음에 추가한다.
- 현재 자동 재생 모션은 없다(`.progress-run`/`.loading-card` CSS는 로딩 카드를 `StreamingCard`로 대체하면서 미사용 상태). 새 자동 애니메이션을 추가하면 `prefers-reduced-motion` 대응을 함께 넣는다.

## Testing Strategy

- 실행: `bun run test`. 환경은 jsdom, 셋업은 `test/setup.ts`(각 테스트 후 `cleanup`).
- 스타일: `@testing-library/react` + `userEvent`, 접근성 역할과 이름으로 조회한다 (`components/PromptInput.test.tsx:9`).
- 현재 테스트는 `PromptInput`만 있다. 나머지 컴포넌트를 수정할 때는 가능하면 같은 이름의 `*.test.tsx`를 옆에 추가한다.

## Local Golden Rules

- Don't: 버튼 텍스트 `컴포넌트 생성`, `생성 중...`을 바꾸지 않는다. 테스트가 이름으로 조회한다 (`PromptInput.test.tsx:9`, `PromptInput.test.tsx:18`, `PromptInput.test.tsx:27`; 원본 `PromptInput.tsx:56-58`). 바꾸면 테스트를 함께 수정한다.
- Don't: `PromptInput`에 `textbox` 역할 요소를 추가하지 않는다. 테스트가 `getByRole('textbox')` 단일 매칭에 의존한다 (`PromptInput.test.tsx:17`).
- Do: 키 상태는 `envKeys`(서버 키 존재 여부)와 입력된 `apiKey` 둘 다 확인한다. 한쪽만 보면 안 된다 (`App.tsx:35`, 상태바 `App.tsx:184`).
- Do: `StreamingCard`의 `role="status"`는 "생성 중" 문구에만 둔다. 코드 영역은 `aria-live="off"`로 유지한다. 델타마다 스크린리더가 코드를 재낭독하지 않게 하기 위해서다.
- Do: `ComponentCard`는 `memo`로 감싸져 있다. 스트리밍 중 리렌더를 피하려면 넘기는 콜백(`handleGenerate` 등)의 참조를 안정적으로 유지한다.
- Do: `ComponentCard`의 탭은 `role="tab"`/`aria-selected`를 유지한다 (`ComponentCard.tsx:55-`).
- Don't: 미리보기 코드에서 `LivePreview`의 `key={previewKey}` 리마운트 방식을 제거하지 않는다. 새로고침 버튼이 이 키 증가에 의존한다 (`ComponentCard.tsx:18`).
- Do: 키 입력값은 `utils/storage.ts`의 `saveApiKey`로만 `localStorage`에 저장한다(provider별). 프로바이더 변경 시 입력 키는 새 provider의 저장된 키로 교체한다(`App.tsx` `handleProviderChange`). 다른 provider의 키가 입력창에 남으면 안 된다.
- Do: `localStorage` 접근은 `utils/storage.ts`를 거친다. 읽기는 깨진 JSON/잘못된 형태를 기본값으로 처리하고, 쓰기 실패(용량 초과)는 던지지 않는다.
