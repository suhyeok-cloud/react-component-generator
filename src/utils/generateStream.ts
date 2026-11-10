// /api/generate/stream의 SSE 응답을 읽어 진행 중인 코드를 전달하고 최종 코드를 반환한다.
// 서버 이벤트 형식: { type: 'delta', text } | { type: 'done', code } | { type: 'error', error }

type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string };

function parseEvents(block: string): StreamEvent[] {
  const events: StreamEvent[] = [];
  for (const rawEvent of block.split('\n\n')) {
    const data = rawEvent
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n');
    if (!data) continue;
    try {
      events.push(JSON.parse(data) as StreamEvent);
    } catch {
      throw new Error('서버 응답을 해석할 수 없습니다. 잠시 후 다시 시도해주세요.');
    }
  }
  return events;
}

export async function consumeGenerateStream(
  response: Response,
  onProgress: (code: string) => void,
): Promise<string> {
  if (!response.body) {
    throw new Error('응답 본문이 없습니다.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  // 이벤트를 처리하고, done이면 최종 코드를 반환한다.
  const handle = (events: StreamEvent[]): string | undefined => {
    for (const event of events) {
      if (event.type === 'delta') {
        accumulated += event.text;
        onProgress(accumulated);
      } else if (event.type === 'error') {
        throw new Error(event.error);
      } else {
        return event.code;
      }
    }
    return undefined;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // CRLF가 청크 경계에서 쪼개질 수 있으므로 누적된 버퍼 전체를 정규화한다.
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      // 마지막 조각은 아직 끝나지 않은 이벤트이므로 버퍼에 남긴다.
      const lastBoundary = buffer.lastIndexOf('\n\n');
      if (lastBoundary === -1) continue;

      const complete = buffer.slice(0, lastBoundary + 2);
      buffer = buffer.slice(lastBoundary + 2);

      const code = handle(parseEvents(complete));
      if (code !== undefined) return code;
    }

    // 스트림이 빈 줄 없이 끝난 경우 남은 이벤트를 처리한다.
    const code = handle(parseEvents((buffer + decoder.decode()).replace(/\r\n/g, '\n')));
    if (code !== undefined) return code;
  } finally {
    // 에러로 빠져나올 때 서버 연결도 함께 끊는다.
    reader.cancel().catch(() => {});
  }

  throw new Error('응답이 중간에 끊겼습니다. 다시 시도해주세요.');
}
