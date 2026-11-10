import { CodeView } from './CodeView';
import { TitleBar } from './TitleBar';

interface StreamingCardProps {
  prompt: string;
  code: string;
}

// 생성 중인 컴포넌트를 보여주는 카드. 코드 탭만 쓸 수 있고, 완료되면 ComponentCard(미리보기 탭)로 교체된다.
export function StreamingCard({ prompt, code }: StreamingCardProps) {
  return (
    <div className="component-card" role="status" aria-label="생성 중인 컴포넌트">
      <TitleBar title="생성 중" />
      <div className="card-header">
        <div className="card-title-group">
          <p className="card-prompt">{prompt}</p>
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
      <div className="card-content">
        <CodeView code={code} />
      </div>
    </div>
  );
}
