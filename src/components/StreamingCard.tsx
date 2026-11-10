import { CodeView } from './CodeView';
import { TitleBar } from './TitleBar';

interface StreamingCardProps {
  prompt: string;
  code: string;
}

// 생성 중인 컴포넌트를 보여주는 카드. 코드 탭만 쓸 수 있고, 완료되면 ComponentCard(미리보기 탭)로 교체된다.
// role="status"는 상태 문구에만 둔다. 코드 영역까지 live region이면 델타마다 스크린리더가 재낭독한다.
export function StreamingCard({ prompt, code }: StreamingCardProps) {
  return (
    <div className="component-card">
      <TitleBar title="생성 중" />
      <div className="card-header">
        <div className="card-title-group">
          <p className="card-prompt">{prompt}</p>
          <span role="status">생성 중...</span>
        </div>
      </div>
      <div className="card-tabs" role="tablist">
        <button role="tab" aria-selected={false} className="tab" disabled>
          미리보기
        </button>
        <button role="tab" aria-selected={true} className="tab tab--active">
          코드
        </button>
      </div>
      <div className="card-content" aria-live="off">
        <CodeView code={code} />
      </div>
    </div>
  );
}
