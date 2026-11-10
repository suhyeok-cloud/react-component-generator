import { describe, it, expect, vi } from 'vitest';
import { buildGistPayload, createGist } from './gist';

const CODE = 'const PricingCard = () => null;\n\nrender(<PricingCard />);';

describe('buildGistPayload', () => {
  it('비공개(secret) Gist로 만든다', () => {
    expect(buildGistPayload('요금제 카드', CODE).public).toBe(false);
  });

  it('컴포넌트 이름으로 .jsx 파일을 만들고 코드를 담는다', () => {
    const { files } = buildGistPayload('요금제 카드', CODE);
    expect(files['PricingCard.jsx']).toEqual({ content: CODE });
  });

  it('컴포넌트 이름을 찾지 못하면 component.jsx를 쓴다', () => {
    const { files } = buildGistPayload('x', 'render(null)');
    expect(files['component.jsx']).toEqual({ content: 'render(null)' });
  });

  it('프롬프트를 설명으로 쓰고 길면 잘라낸다', () => {
    expect(buildGistPayload('요금제 카드', CODE).description).toBe('요금제 카드');
    expect(buildGistPayload('가'.repeat(300), CODE).description).toHaveLength(100);
  });

  it('프롬프트 전문을 PROMPT.md 파일로 함께 담는다', () => {
    const { files } = buildGistPayload('요금제 카드', CODE);
    expect(files['PROMPT.md']).toEqual({ content: '요금제 카드' });
  });
});

describe('createGist', () => {
  const payload = buildGistPayload('p', CODE);

  it('성공하면 Gist의 html_url을 돌려준다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ html_url: 'https://gist.github.com/u/abc' }), { status: 201 })
    );

    await expect(createGist('tok', payload, fetchImpl)).resolves.toBe('https://gist.github.com/u/abc');
  });

  it('토큰을 Authorization 헤더로 보내고 본문에는 넣지 않는다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ html_url: 'u' }), { status: 201 })
    );

    await createGist('tok-secret', payload, fetchImpl);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.github.com/gists');
    expect(init.headers.Authorization).toBe('Bearer tok-secret');
    expect(init.body).not.toContain('tok-secret');
  });

  it('실패하면 상태 코드만 담은 에러를 던진다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"message":"Bad credentials"}', { status: 401 }));

    await expect(createGist('tok-secret', payload, fetchImpl)).rejects.toThrow('GitHub API error: 401');
  });
});
