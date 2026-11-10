import { describe, it, expect } from 'vitest';
import { shouldRemindTdd, TDD_REMINDER } from './tdd-reminder';

describe('shouldRemindTdd', () => {
  it('서버 소스 파일이면 true를 반환한다', () => {
    expect(shouldRemindTdd('server/generator.ts')).toBe(true);
  });

  it('React 컴포넌트 파일이면 true를 반환한다 (판단이 애매하면 적용 대상)', () => {
    expect(shouldRemindTdd('src/App.tsx')).toBe(true);
  });

  it('윈도우 경로 구분자가 있어도 true를 반환한다', () => {
    expect(shouldRemindTdd('C:\\proj\\src\\utils\\storage.ts')).toBe(true);
  });

  it('.test.ts 파일이면 false를 반환한다 (RED 단계 작성)', () => {
    expect(shouldRemindTdd('server/generator.test.ts')).toBe(false);
  });

  it('.test.tsx 파일이면 false를 반환한다', () => {
    expect(shouldRemindTdd('src/components/PromptInput.test.tsx')).toBe(false);
  });

  it('마크다운 문서면 false를 반환한다', () => {
    expect(shouldRemindTdd('AGENTS.md')).toBe(false);
  });

  it('JSON 설정 파일이면 false를 반환한다', () => {
    expect(shouldRemindTdd('.claude/settings.json')).toBe(false);
  });

  it('CSS 파일이면 false를 반환한다', () => {
    expect(shouldRemindTdd('src/App.css')).toBe(false);
  });
});

describe('TDD_REMINDER', () => {
  it('tdd.md 규칙 파일 경로를 안내한다', () => {
    expect(TDD_REMINDER).toContain('.claude/rules/tdd.md');
  });
});
