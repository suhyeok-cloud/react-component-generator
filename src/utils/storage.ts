import type { GeneratedComponent, Provider } from '../types';

export const MAX_HISTORY = 20;

const KEYS = {
  provider: 'rcg:provider',
  apiKeys: 'rcg:apiKeys',
  history: 'rcg:history',
  components: 'rcg:components',
} as const;

const PROVIDERS: Provider[] = ['anthropic', 'google'];

function readJSON(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

// 용량 초과·사생활 보호 모드 등으로 쓰기가 실패해도 앱 동작은 막지 않는다.
function writeJSON(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패는 무시한다.
  }
}

function isProvider(value: unknown): value is Provider {
  return PROVIDERS.includes(value as Provider);
}

export function loadProvider(storage: Storage): Provider | null {
  try {
    const value = storage.getItem(KEYS.provider);
    return isProvider(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveProvider(storage: Storage, provider: Provider): void {
  try {
    storage.setItem(KEYS.provider, provider);
  } catch {
    // 저장 실패는 무시한다.
  }
}

export function loadApiKeys(storage: Storage): Partial<Record<Provider, string>> {
  const data = readJSON(storage, KEYS.apiKeys);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};

  const keys: Partial<Record<Provider, string>> = {};
  for (const provider of PROVIDERS) {
    const value = (data as Record<string, unknown>)[provider];
    if (typeof value === 'string' && value) keys[provider] = value;
  }
  return keys;
}

export function saveApiKey(storage: Storage, provider: Provider, key: string): void {
  const keys = loadApiKeys(storage);
  if (key) {
    keys[provider] = key;
  } else {
    delete keys[provider];
  }
  writeJSON(storage, KEYS.apiKeys, keys);
}

export function addToHistory(history: string[], prompt: string): string[] {
  const trimmed = prompt.trim();
  if (!trimmed) return history;
  return [trimmed, ...history.filter((item) => item !== trimmed)].slice(0, MAX_HISTORY);
}

export function loadHistory(storage: Storage): string[] {
  const data = readJSON(storage, KEYS.history);
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is string => typeof item === 'string');
}

export function saveHistory(storage: Storage, history: string[]): void {
  writeJSON(storage, KEYS.history, history);
}

export function loadComponents(storage: Storage): GeneratedComponent[] {
  const data = readJSON(storage, KEYS.components);
  if (!Array.isArray(data)) return [];

  const components: GeneratedComponent[] = [];
  for (const item of data) {
    if (typeof item !== 'object' || item === null) continue;
    const { id, prompt, code, createdAt } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof prompt !== 'string' || typeof code !== 'string') continue;
    if (typeof createdAt !== 'string') continue;
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) continue;
    components.push({ id, prompt, code, createdAt: date });
  }
  return components;
}

export function saveComponents(storage: Storage, components: GeneratedComponent[]): void {
  writeJSON(storage, KEYS.components, components);
}
