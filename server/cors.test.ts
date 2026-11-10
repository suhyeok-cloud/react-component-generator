import { describe, it, expect } from 'vitest';
import { isAllowedOrigin, buildCorsHeaders } from './cors';

describe('isAllowedOrigin', () => {
  it('Origin 헤더가 없는 요청(curl, 서버 간 호출)은 허용한다', () => {
    expect(isAllowedOrigin(null)).toBe(true);
  });

  it('localhost의 임의 포트를 허용한다', () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('http://localhost:5174')).toBe(true);
  });

  it('127.0.0.1의 임의 포트를 허용한다', () => {
    expect(isAllowedOrigin('http://127.0.0.1:5173')).toBe(true);
  });

  it('외부 도메인은 거부한다', () => {
    expect(isAllowedOrigin('https://evil.example')).toBe(false);
  });

  it('localhost로 시작하는 다른 도메인은 거부한다', () => {
    expect(isAllowedOrigin('http://localhost.evil.com')).toBe(false);
  });

  it('localhost 뒤에 도메인이 이어붙은 Origin은 거부한다', () => {
    expect(isAllowedOrigin('http://localhost:5173.evil.com')).toBe(false);
  });

  it('userinfo로 localhost를 위장한 Origin은 거부한다', () => {
    expect(isAllowedOrigin('http://localhost@evil.com')).toBe(false);
  });

  it('https localhost는 거부한다', () => {
    expect(isAllowedOrigin('https://localhost:5173')).toBe(false);
  });

  it('null Origin(샌드박스 iframe 등)은 거부한다', () => {
    expect(isAllowedOrigin('null')).toBe(false);
  });
});

describe('buildCorsHeaders', () => {
  it('허용된 Origin은 그대로 Allow-Origin에 반영하고 Vary를 붙인다', () => {
    const headers = buildCorsHeaders('http://localhost:5173');
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(headers['Vary']).toBe('Origin');
  });

  it('Origin이 없으면 Allow-Origin을 붙이지 않는다', () => {
    expect(buildCorsHeaders(null)['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('메서드와 헤더 허용 목록은 항상 포함한다', () => {
    const headers = buildCorsHeaders(null);
    expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
    expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type');
  });
});
