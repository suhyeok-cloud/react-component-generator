import { describe, it, expect } from 'vitest';
import { isGitCommitCommand } from './commit-guard';

describe('isGitCommitCommand', () => {
  it('git commit 명령이면 true를 반환한다', () => {
    expect(isGitCommitCommand('git commit -m "feat: 추가"')).toBe(true);
  });

  it('&&로 이어진 명령 중 git commit이 있으면 true를 반환한다', () => {
    expect(isGitCommitCommand('git add . && git commit -m "x"')).toBe(true);
  });

  it('git 전역 옵션이 앞에 붙어도 true를 반환한다', () => {
    expect(isGitCommitCommand('git -C ./app commit -m "x"')).toBe(true);
  });

  it('git commit이 아닌 git 명령이면 false를 반환한다', () => {
    expect(isGitCommitCommand('git status')).toBe(false);
  });

  it('commit이 인자로만 들어간 git 명령이면 false를 반환한다', () => {
    expect(isGitCommitCommand('git log --grep commit')).toBe(false);
  });

  it('git commit-tree 같은 다른 서브커맨드면 false를 반환한다', () => {
    expect(isGitCommitCommand('git commit-tree HEAD^{tree}')).toBe(false);
  });

  it('echo 인자에 git commit 문자열이 있어도 false를 반환한다', () => {
    expect(isGitCommitCommand('echo "git commit"')).toBe(false);
  });
});
