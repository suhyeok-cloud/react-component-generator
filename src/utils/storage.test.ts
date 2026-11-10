import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadProvider,
  saveProvider,
  loadApiKeys,
  saveApiKey,
  addToHistory,
  loadHistory,
  saveHistory,
  loadComponents,
  saveComponents,
  MAX_HISTORY,
} from './storage';

beforeEach(() => {
  localStorage.clear();
});

describe('provider 저장', () => {
  it('저장한 provider를 다시 읽어온다', () => {
    saveProvider(localStorage, 'anthropic');
    expect(loadProvider(localStorage)).toBe('anthropic');
  });

  it('저장된 값이 없으면 null을 돌려준다', () => {
    expect(loadProvider(localStorage)).toBeNull();
  });

  it('알 수 없는 provider 값은 무시한다', () => {
    localStorage.setItem('rcg:provider', 'openai');
    expect(loadProvider(localStorage)).toBeNull();
  });
});

describe('API 키 저장', () => {
  it('provider별로 키를 따로 저장한다', () => {
    saveApiKey(localStorage, 'google', 'AIza-1');
    saveApiKey(localStorage, 'anthropic', 'sk-ant-1');
    expect(loadApiKeys(localStorage)).toEqual({ google: 'AIza-1', anthropic: 'sk-ant-1' });
  });

  it('빈 키를 저장하면 해당 provider의 키를 지운다', () => {
    saveApiKey(localStorage, 'google', 'AIza-1');
    saveApiKey(localStorage, 'anthropic', 'sk-ant-1');
    saveApiKey(localStorage, 'google', '');
    expect(loadApiKeys(localStorage)).toEqual({ anthropic: 'sk-ant-1' });
  });

  it('JSON이 깨져 있으면 빈 객체를 돌려준다', () => {
    localStorage.setItem('rcg:apiKeys', '{broken');
    expect(loadApiKeys(localStorage)).toEqual({});
  });
});

describe('addToHistory', () => {
  it('새 프롬프트를 맨 앞에 추가한다', () => {
    expect(addToHistory(['a'], 'b')).toEqual(['b', 'a']);
  });

  it('이미 있는 프롬프트는 중복 없이 맨 앞으로 올린다', () => {
    expect(addToHistory(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
  });

  it(`최대 ${MAX_HISTORY}개까지만 유지한다`, () => {
    const full = Array.from({ length: MAX_HISTORY }, (_, i) => `p${i}`);
    const result = addToHistory(full, 'new');
    expect(result).toHaveLength(MAX_HISTORY);
    expect(result[0]).toBe('new');
    expect(result).not.toContain(`p${MAX_HISTORY - 1}`);
  });

  it('앞뒤 공백을 제거하고, 빈 프롬프트는 추가하지 않는다', () => {
    expect(addToHistory(['a'], '  b  ')).toEqual(['b', 'a']);
    expect(addToHistory(['a'], '   ')).toEqual(['a']);
  });
});

describe('히스토리 저장', () => {
  it('저장한 히스토리를 다시 읽어온다', () => {
    saveHistory(localStorage, ['b', 'a']);
    expect(loadHistory(localStorage)).toEqual(['b', 'a']);
  });

  it('배열이 아닌 값은 빈 배열로 처리한다', () => {
    localStorage.setItem('rcg:history', '{"a":1}');
    expect(loadHistory(localStorage)).toEqual([]);
  });

  it('문자열이 아닌 항목은 걸러낸다', () => {
    localStorage.setItem('rcg:history', '["a", 1, null, "b"]');
    expect(loadHistory(localStorage)).toEqual(['a', 'b']);
  });
});

describe('컴포넌트 목록 저장', () => {
  const sample = {
    id: '1-abc',
    prompt: '버튼',
    code: 'render(<A />)',
    createdAt: new Date('2026-11-10T09:30:00.000Z'),
  };

  it('저장 후 읽으면 createdAt이 Date로 복원된다', () => {
    saveComponents(localStorage, [sample]);
    const [loaded] = loadComponents(localStorage);
    expect(loaded.createdAt).toBeInstanceOf(Date);
    expect(loaded).toEqual(sample);
  });

  it('필드가 빠졌거나 날짜가 잘못된 항목은 걸러낸다', () => {
    localStorage.setItem(
      'rcg:components',
      JSON.stringify([
        { id: 'x', prompt: 'p' },
        { ...sample, createdAt: 'not-a-date' },
        { ...sample, createdAt: sample.createdAt.toISOString() },
      ])
    );
    expect(loadComponents(localStorage)).toEqual([sample]);
  });

  it('JSON이 깨져 있으면 빈 배열을 돌려준다', () => {
    localStorage.setItem('rcg:components', 'oops');
    expect(loadComponents(localStorage)).toEqual([]);
  });

  it('저장소가 가득 차 쓰기에 실패해도 예외를 던지지 않는다', () => {
    const full = {
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
    } as unknown as Storage;
    expect(() => saveComponents(full, [sample])).not.toThrow();
  });
});
