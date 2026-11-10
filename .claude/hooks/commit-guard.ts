// 명령어 체인(&&, ||, ;, |, 개행)을 구간으로 나눠 각 구간이 git commit인지 검사한다.
const SEGMENT_SEPARATOR = /&&|\|\||[;|\n]/;
const GIT_COMMIT = /^git\s+(?:(?:-C|-c)\s+\S+\s+|-{1,2}\S+\s+)*commit(?:\s|$)/;

export function isGitCommitCommand(command: string): boolean {
  return command
    .split(SEGMENT_SEPARATOR)
    .some((segment) => GIT_COMMIT.test(segment.trim()));
}
