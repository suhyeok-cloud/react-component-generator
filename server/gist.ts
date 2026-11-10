// GitHub Gist 생성 요청을 만들고 보내는 함수들. 부수효과(Bun.serve 등)가 없어 테스트할 수 있다.

export interface GistPayload {
  description: string;
  public: boolean;
  files: Record<string, { content: string }>;
}

const MAX_DESCRIPTION_LENGTH = 100;

export function buildGistPayload(prompt: string, code: string): GistPayload {
  const name = code.match(/(?:const|function)\s+([A-Z]\w+)/)?.[1] ?? 'component';

  return {
    description: prompt.slice(0, MAX_DESCRIPTION_LENGTH),
    public: false,
    files: {
      [`${name}.jsx`]: { content: code },
      'PROMPT.md': { content: prompt },
    },
  };
}

/** Gist를 만들고 html_url을 돌려준다. 에러에는 상태 코드만 담는다 (토큰·응답 본문 노출 방지). */
export async function createGist(
  token: string,
  payload: GistPayload,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const response = await fetchImpl('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = (await response.json()) as { html_url: string };
  return data.html_url;
}
