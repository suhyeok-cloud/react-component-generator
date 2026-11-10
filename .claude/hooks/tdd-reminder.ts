export const TDD_REMINDER = [
  '[TDD 규칙 상기] 코드를 작성/수정하기 전에 .claude/rules/tdd.md를 따른다 (Rigid, 변형 금지).',
  '1. RED: 동작 하나당 실패하는 테스트를 먼저 쓰고, 실행해서 "기능 미구현"으로 실패하는 것을 확인한다.',
  '2. GREEN: 테스트를 통과시키는 최소한의 코드만 쓴다. 신규+기존 테스트가 모두 통과해야 한다.',
  '3. REFACTOR: 새 동작 없이 정리만 한다. 테스트는 항상 green을 유지한다.',
  '테스트보다 프로덕션 코드를 먼저 썼다면 그 코드를 삭제하고 RED부터 다시 시작한다. 버그 수정도 재현 테스트가 먼저다.',
].join('\n');

const CODE_FILE = /\.(?:ts|tsx|js|jsx)$/;
const TEST_FILE = /\.test\.(?:ts|tsx|js|jsx)$/;

export function shouldRemindTdd(filePath: string): boolean {
  return CODE_FILE.test(filePath) && !TEST_FILE.test(filePath);
}
