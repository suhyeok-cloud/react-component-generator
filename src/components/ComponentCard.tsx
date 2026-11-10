import { memo, useState } from 'react';
import type { GeneratedComponent } from '../types';
import { LivePreview } from './LivePreview';
import { CodeView } from './CodeView';
import { TitleBar } from './TitleBar';

interface ComponentCardProps {
  component: GeneratedComponent;
  onRemove: (id: string) => void;
  onRegenerate: (prompt: string) => void;
  onExportGist: (component: GeneratedComponent) => Promise<string | null>;
  isLoading: boolean;
}

type Tab = 'preview' | 'code';

// 스트리밍 중 App이 리렌더돼도 props가 같은 카드는 다시 그리지 않도록 memo로 감싼다.
export const ComponentCard = memo(function ComponentCard({
  component,
  onRemove,
  onRegenerate,
  onExportGist,
  isLoading,
}: ComponentCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('preview');
  const [previewKey, setPreviewKey] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [gistUrl, setGistUrl] = useState<string | null>(null);

  const handleExportGist = async () => {
    if (!confirm('이 프롬프트와 코드를 비공개(secret) GitHub Gist로 업로드할까요?')) return;
    setIsExporting(true);
    setGistUrl(await onExportGist(component));
    setIsExporting(false);
  };
  const createdAt = component.createdAt.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="component-card">
      <TitleBar title={`컴포넌트 · ${createdAt}`} />
      <div className="card-header">
        <div className="card-title-group">
          <p className="card-prompt">{component.prompt}</p>
          {gistUrl && (
            <a href={gistUrl} target="_blank" rel="noreferrer">
              Gist 열기
            </a>
          )}
        </div>
        <div className="card-actions">
          <button
            className="btn-refresh"
            onClick={() => setPreviewKey((k) => k + 1)}
            title="미리보기 새로고침"
            aria-label="미리보기 새로고침"
          >
            ↻
          </button>
          <button
            className="btn-regenerate"
            onClick={() => onRegenerate(component.prompt)}
            disabled={isLoading}
          >
            {isLoading ? '생성 중...' : '재생성'}
          </button>
          <button
            className="btn-regenerate"
            onClick={handleExportGist}
            disabled={isExporting}
          >
            {isExporting ? '내보내는 중...' : 'Gist로 내보내기'}
          </button>
          <button
            className="btn-remove"
            onClick={() => onRemove(component.id)}
          >
            삭제
          </button>
        </div>
      </div>
      <div className="card-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'preview'}
          className={`tab ${activeTab === 'preview' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          미리보기
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'code'}
          className={`tab ${activeTab === 'code' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('code')}
        >
          코드
        </button>
      </div>
      <div className="card-content">
        {activeTab === 'preview' ? (
          <LivePreview key={previewKey} code={component.code} />
        ) : (
          <CodeView code={component.code} />
        )}
      </div>
    </div>
  );
});
