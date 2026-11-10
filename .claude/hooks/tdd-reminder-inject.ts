// PreToolUse 훅: 코드 파일을 생성/수정하기 전에 TDD 규칙 리마인더를 컨텍스트로 주입한다.
import { shouldRemindTdd, TDD_REMINDER } from './tdd-reminder';

const input = JSON.parse(await Bun.stdin.text());
const filePath: string = input?.tool_input?.file_path ?? '';

if (shouldRemindTdd(filePath)) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: TDD_REMINDER,
      },
    }),
  );
}
