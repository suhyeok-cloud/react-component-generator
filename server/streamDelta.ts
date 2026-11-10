// 프로바이더 스트리밍 이벤트(SSE data)에서 텍스트 조각을 꺼내는 순수 함수들.

export interface StreamDelta {
  text: string;
  /** 출력 토큰 한도로 응답이 잘렸다. */
  truncated: boolean;
  /** 프로바이더가 정상 종료 신호를 보냈다. */
  finished: boolean;
  /** 스트림 도중 프로바이더가 보낸 에러. `... error: ${상태}` 형식을 지켜 classifyError가 분류한다. */
  error?: string;
}

const EMPTY: StreamDelta = { text: '', truncated: false, finished: false };

const ANTHROPIC_ERROR_STATUS = new Map([
  ['overloaded_error', '503'],
  ['rate_limit_error', '429'],
]);

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function extractAnthropicDelta(data: string): StreamDelta {
  const event = parseJson(data) as {
    type?: string;
    delta?: { type?: string; text?: string };
    error?: { type?: string };
  } | null;

  if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return { ...EMPTY, text: event.delta.text ?? '' };
  }
  if (event?.type === 'message_stop') {
    return { ...EMPTY, finished: true };
  }
  if (event?.type === 'error') {
    const type = event.error?.type ?? 'unknown';
    // classifyError가 숫자 상태로 분류하므로 과부하·요청 과다는 상태 코드로 바꿔 담는다.
    return { ...EMPTY, error: `Claude API error: ${ANTHROPIC_ERROR_STATUS.get(type) ?? type}` };
  }
  return EMPTY;
}

export function extractGoogleDelta(data: string): StreamDelta {
  const event = parseJson(data) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    error?: { code?: number };
  } | null;

  if (event?.error) {
    return { ...EMPTY, error: `Gemini API error: ${event.error.code ?? 'unknown'}` };
  }

  const candidate = event?.candidates?.[0];
  if (!candidate) return EMPTY;

  return {
    text: candidate.content?.parts?.map((part) => part.text ?? '').join('') ?? '',
    truncated: candidate.finishReason === 'MAX_TOKENS',
    finished: !!candidate.finishReason,
  };
}
