// SSE(Server-Sent Events) 스트림을 다루는 순수 함수들. 부수효과가 없어 단위 테스트가 가능하다.

function extractData(event: string): string {
  return event
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
    .join('\n');
}

/** 청크 단위로 들어오는 SSE 텍스트에서 완성된 이벤트의 `data:` 값만 뽑아내는 파서. */
export function createSseParser(): { push: (chunk: string) => string[]; flush: () => string[] } {
  let buffer = '';

  return {
    push(chunk: string): string[] {
      // CRLF가 청크 경계에서 쪼개질 수 있으므로 누적된 버퍼 전체를 정규화한다.
      buffer = (buffer + chunk).replace(/\r\n/g, '\n');
      const events = buffer.split('\n\n');
      // 마지막 조각은 아직 끝나지 않은 이벤트이므로 버퍼에 남긴다.
      buffer = events.pop() ?? '';

      return events.map(extractData).filter(Boolean);
    },

    /** 스트림이 끝났을 때 빈 줄 없이 남은 마지막 이벤트를 꺼낸다. */
    flush(): string[] {
      const rest = extractData(buffer.replace(/\r\n/g, '\n'));
      buffer = '';
      return rest ? [rest] : [];
    },
  };
}

/** 객체를 SSE 이벤트 한 건(`data: {json}` + 빈 줄)으로 직렬화한다. */
export function formatSseEvent(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
