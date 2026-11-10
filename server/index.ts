import { stripCodeFences, ensureRenderCall } from './generator';
import { withModelFallback } from './fallback';
import { buildGistPayload, createGist } from './gist';
import { classifyError, UserFacingError } from './errors';
import { buildCorsHeaders, isAllowedOrigin } from './cors';
import { createConcurrencyLimiter } from './limiter';
import { readDeltas } from './readDeltas';
import { extractAnthropicDelta, extractGoogleDelta, type StreamDelta } from './streamDelta';
import { buildStreamEvents } from './streamEvents';
import { createSseStream } from './streamResponse';
import { isProvider, validateGenerateRequest } from './validation';

// 우선순위 순서. 앞 모델이 실패하면 다음 모델로 폴백한다.
const GOOGLE_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash'];

const SYSTEM_PROMPT = `You are a React component generator. Generate a single React component based on the user's description.

Rules:
- Use inline styles only (no CSS imports, no CSS modules)
- Do NOT use import statements — React is already available in scope as a global
- Define the component as a function, then call render(<ComponentName />) at the end
- Make the component visually appealing with proper styling
- Use React hooks if needed (e.g., React.useState, React.useEffect)
- The component must be completely self-contained
- Respond with ONLY the code block — no explanations, no markdown fences
- Use descriptive variable names and clean formatting
- For colors, prefer modern palettes (gradients, shadows, etc.)
- Ensure the component is interactive where appropriate (hover states, click handlers, etc.)
- Do NOT use TypeScript syntax — no type annotations, no interfaces, no generics, no "as" casts. Write plain JavaScript only.

Example output format:
const GradientButton = () => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      style={{
        background: hovered
          ? 'linear-gradient(135deg, #667eea, #764ba2)'
          : 'linear-gradient(135deg, #764ba2, #667eea)',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      Click me
    </button>
  );
};

render(<GradientButton />);`;

// 서버 env 키로 비용이 발생하므로 동시에 진행할 수 있는 스트림 수를 제한한다.
const MAX_CONCURRENT_STREAMS = 3;
// 프로바이더가 응답 헤더를 주지 않고 멈춰도 동시 실행 슬롯이 무기한 점유되지 않게 한다.
const CONNECT_TIMEOUT_MS = 20_000;
const streamLimiter = createConcurrencyLimiter(MAX_CONCURRENT_STREAMS);

type Provider = 'anthropic' | 'google';

const ENV_KEYS: Record<Provider, string | undefined> = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  google: process.env.GOOGLE_API_KEY,
};

function resolveApiKey(provider: Provider, clientKey?: string): string | null {
  return clientKey || ENV_KEYS[provider] || null;
}

async function callAnthropic(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  return data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

async function callGoogleModel(prompt: string, apiKey: string, model: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates: Array<{
      content: { parts: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new UserFacingError('생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.');
  }

  return (
    candidate?.content?.parts
      ?.map((part) => part.text)
      ?.join('') ?? ''
  );
}

async function callGoogle(prompt: string, apiKey: string): Promise<string> {
  return withModelFallback(GOOGLE_MODELS, (model) => callGoogleModel(prompt, apiKey, model));
}

// 연결 단계에서 실패하면 던진다. 성공하면 델타 스트림을 반환한다.
// signal이 abort되면 프로바이더 요청도 함께 중단된다(클라이언트가 연결을 끊었을 때 토큰 낭비 방지).
async function streamAnthropic(
  prompt: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<AsyncGenerator<StreamDelta>> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  return readDeltas(response, extractAnthropicDelta);
}

async function streamGoogleModel(
  prompt: string,
  apiKey: string,
  model: string,
  signal: AbortSignal,
): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  return response;
}

// 모델 폴백은 연결 단계에만 적용된다. 스트림이 시작된 뒤에는 다른 모델로 넘어가지 않는다.
async function streamGoogle(
  prompt: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<AsyncGenerator<StreamDelta>> {
  const response = await withModelFallback(GOOGLE_MODELS, (model) =>
    streamGoogleModel(prompt, apiKey, model, signal),
  );
  return readDeltas(response, extractGoogleDelta);
}

const server = Bun.serve({
  port: 3002,
  // 로컬 개발용이므로 외부 인터페이스(LAN)에는 열지 않는다.
  hostname: '127.0.0.1',
  // 모델 응답 사이 간격이 길어도 스트림이 끊기지 않도록 기본값(10초)보다 늘린다.
  idleTimeout: 60,
  async fetch(req) {
    const origin = req.headers.get('origin');
    // 모든 응답에 붙이는 CORS 헤더. 허용된 로컬 Origin만 반영한다(`*` 사용 안 함).
    const cors = buildCorsHeaders(origin);

    // 임의 웹페이지가 서버 env 키로 비용을 일으키지 못하게 cross-origin 요청을 거부한다.
    if (!isAllowedOrigin(origin)) {
      return Response.json({ error: 'Forbidden origin' }, { status: 403 });
    }

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/api/config') {
      return Response.json(
        {
          envKeys: {
            anthropic: !!ENV_KEYS.anthropic,
            google: !!ENV_KEYS.google,
          },
        },
        { headers: cors }
      );
    }

    if (req.method === 'POST' && url.pathname === '/api/generate') {
      try {
        const { prompt, apiKey, provider = 'anthropic' } = (await req.json()) as {
          prompt?: unknown;
          apiKey?: unknown;
          provider?: unknown;
        };

        if (!isProvider(provider)) {
          return Response.json({ error: 'Invalid provider' }, { status: 400, headers: cors });
        }

        const resolvedKey = resolveApiKey(provider, typeof apiKey === 'string' ? apiKey : undefined);

        const validationError = validateGenerateRequest(prompt, resolvedKey, provider);
        if (validationError || !resolvedKey || typeof prompt !== 'string') {
          return Response.json(
            { error: validationError ?? 'Invalid request' },
            { status: 400, headers: cors }
          );
        }

        const text =
          provider === 'google'
            ? await callGoogle(prompt, resolvedKey)
            : await callAnthropic(prompt, resolvedKey);

        const code = ensureRenderCall(stripCodeFences(text));

        return Response.json({ code }, { headers: cors });
      } catch (err) {
        const { status, message } = classifyError(err);
        return Response.json({ error: message }, { status, headers: cors });
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/generate/stream') {
      try {
        const { prompt, apiKey, provider = 'anthropic' } = (await req.json()) as {
          prompt?: unknown;
          apiKey?: unknown;
          provider?: unknown;
        };

        if (!isProvider(provider)) {
          return Response.json({ error: 'Invalid provider' }, { status: 400, headers: cors });
        }

        const resolvedKey = resolveApiKey(provider, typeof apiKey === 'string' ? apiKey : undefined);

        const validationError = validateGenerateRequest(prompt, resolvedKey, provider);
        if (validationError || !resolvedKey || typeof prompt !== 'string') {
          return Response.json(
            { error: validationError ?? 'Invalid request' },
            { status: 400, headers: cors }
          );
        }

        const release = streamLimiter.acquire();
        if (!release) {
          return Response.json(
            { error: '동시에 생성할 수 있는 요청 수를 초과했습니다. 잠시 후 다시 시도해주세요.' },
            { status: 429, headers: cors }
          );
        }

        // 클라이언트가 연결을 끊거나(연결 단계 포함) 프로바이더가 응답하지 않으면 업스트림을 중단한다.
        const upstream = new AbortController();
        const abortUpstream = () => upstream.abort();
        req.signal.addEventListener('abort', abortUpstream, { once: true });
        const connectTimer = setTimeout(abortUpstream, CONNECT_TIMEOUT_MS);

        // 연결 단계 에러는 일반 JSON 에러로, 스트림 시작 후 에러는 error 이벤트로 전달한다.
        let deltas: AsyncGenerator<StreamDelta>;
        try {
          deltas =
            provider === 'google'
              ? await streamGoogle(prompt, resolvedKey, upstream.signal)
              : await streamAnthropic(prompt, resolvedKey, upstream.signal);
        } catch (err) {
          req.signal.removeEventListener('abort', abortUpstream);
          release();
          throw err;
        } finally {
          clearTimeout(connectTimer);
        }

        // 스트림이 끝나거나 취소되면 업스트림을 중단하고 동시 실행 슬롯을 반납한다.
        const body = createSseStream(buildStreamEvents(deltas), () => {
          req.signal.removeEventListener('abort', abortUpstream);
          upstream.abort();
          release();
        });

        return new Response(body, {
          headers: {
            ...cors,
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        });
      } catch (err) {
        const { status, message } = classifyError(err);
        return Response.json({ error: message }, { status, headers: cors });
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/gist') {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        return Response.json(
          { error: 'GITHUB_TOKEN이 설정되지 않았습니다. .env에 gist 권한이 있는 토큰을 추가해주세요.' },
          { status: 400, headers: cors }
        );
      }

      try {
        const { prompt, code } = (await req.json()) as { prompt?: string; code?: string };
        if (!prompt || !code) {
          return Response.json(
            { error: 'Prompt and code are required' },
            { status: 400, headers: cors }
          );
        }

        const gistUrl = await createGist(token, buildGistPayload(prompt, code));
        return Response.json({ url: gistUrl }, { headers: cors });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return Response.json({ error: message }, { status: 500, headers: cors });
      }
    }

    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: cors }
    );
  },
});

console.log(`API server running at http://localhost:${server.port}`);
