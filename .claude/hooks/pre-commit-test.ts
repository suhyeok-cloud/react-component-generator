// PreToolUse 훅: git commit 직전에 테스트를 실행하고, 실패하면 exit 2로 커밋을 차단한다.
import { isGitCommitCommand } from './commit-guard';

const input = JSON.parse(await Bun.stdin.text());
const command: string = input?.tool_input?.command ?? '';

if (isGitCommitCommand(command)) {
  const proc = Bun.spawn(['bun', 'run', 'test'], {
    cwd: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
    stdout: 'inherit',
    stderr: 'inherit',
  });
  // 훅 stdout은 차단 판정에 쓰이지 않으므로 테스트 출력은 stderr로 보낸다.
  if ((await proc.exited) !== 0) {
    console.error('테스트가 실패하여 커밋을 차단했습니다. 모든 테스트가 통과해야 커밋할 수 있습니다.');
    process.exit(2);
  }
}
