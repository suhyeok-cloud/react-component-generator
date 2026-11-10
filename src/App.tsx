import { useState, useEffect } from 'react';
import { PromptInput } from './components/PromptInput';
import { ComponentCard } from './components/ComponentCard';
import { StreamingCard } from './components/StreamingCard';
import { TitleBar } from './components/TitleBar';
import { useComponentGenerator } from './hooks/useComponentGenerator';
import { loadApiKeys, loadProvider, saveApiKey, saveProvider } from './utils/storage';
import type { Provider } from './types';
import './App.css';

const PROVIDER_CONFIG = {
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...' },
  google: { label: 'Google', placeholder: 'AIza...' },
} as const;

function App() {
  const [provider, setProvider] = useState<Provider>(() => loadProvider(localStorage) ?? 'google');
  const [apiKey, setApiKey] = useState(() => loadApiKeys(localStorage)[provider] ?? '');
  const [showKey, setShowKey] = useState(false);
  const [envKeys, setEnvKeys] = useState<Record<Provider, boolean>>({
    anthropic: false,
    google: false,
  });
  const { components, history, isLoading, streaming, error, generate, removeComponent, clearAll, exportToGist } =
    useComponentGenerator();

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setEnvKeys(data.envKeys))
      .catch(() => {});
  }, []);

  const hasEnvKey = envKeys[provider];

  const handleGenerate = (prompt: string) => {
    if (!apiKey.trim() && !hasEnvKey) {
      alert(`${PROVIDER_CONFIG[provider].label} API 키를 입력하거나 .env에 설정해주세요.`);
      return;
    }
    generate(prompt, apiKey || undefined, provider);
  };

  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    saveProvider(localStorage, newProvider);
    setApiKey(loadApiKeys(localStorage)[newProvider] ?? '');
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    saveApiKey(localStorage, provider, value);
  };

  const activeProvider = PROVIDER_CONFIG[provider].label;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-copy">
          <h1>프롬프트로 만드는 UI 워크벤치</h1>
          <p>만들고 싶은 화면을 글로 적으면 React 컴포넌트가 생성됩니다. 결과는 바로 미리 보고, 코드로 복사할 수 있습니다.</p>
        </div>
        <div className="header-meta" aria-label="현재 작업 상태">
          <div>
            <span>AI 제공사</span>
            <strong>{activeProvider}</strong>
          </div>
          <div>
            <span>생성된 컴포넌트</span>
            <strong>{components.length}개</strong>
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="composer-panel" aria-label="컴포넌트 생성">
          <TitleBar title="새 컴포넌트" />
          <div className="window-body">
            <PromptInput onGenerate={handleGenerate} isLoading={isLoading} history={history} />
          </div>
        </section>

        <aside className="settings-panel" aria-label="실행 설정">
          <TitleBar title="실행 설정" />
          <div className="window-body settings-body">
          <div className="provider-select">
            <label htmlFor="provider">Provider</label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as Provider)}
            >
              {Object.entries(PROVIDER_CONFIG).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="api-key-input">
            <label htmlFor="api-key">
              API Key
            </label>
            <div className="api-key-field">
              <input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder={
                  hasEnvKey
                    ? '서버 키 사용 중 (직접 입력으로 덮어쓰기 가능)'
                    : PROVIDER_CONFIG[provider].placeholder
                }
              />
              <button
                className="btn-toggle-key"
                onClick={() => setShowKey(!showKey)}
                type="button"
              >
                {showKey ? '숨기기' : '보기'}
              </button>
            </div>
            <p className={`key-status ${hasEnvKey ? 'key-status--ready' : ''}`}>
              {hasEnvKey ? '.env 키가 연결되어 있습니다.' : '직접 입력하거나 서버 환경변수를 설정하세요.'}
            </p>
          </div>
          </div>
        </aside>
      </main>

      {error && (
        <div className="error-banner" role="alert">
          <p>{error}</p>
        </div>
      )}

      <section className="results-section">
        {components.length > 0 && (
          <div className="results-header">
            <h2>생성된 컴포넌트</h2>
            <button className="btn-clear" onClick={clearAll}>
              전체 삭제
            </button>
          </div>
        )}

        {components.length === 0 && !isLoading && (
          <div className="empty-state">
            <TitleBar title="결과" />
            <div className="window-body">
              <div className="empty-icon" aria-hidden="true">
                {'</>'}
              </div>
              <div className="empty-copy">
                <h2>아직 만든 컴포넌트가 없습니다.</h2>
                <p>위 입력창에 원하는 화면을 설명하고 ‘컴포넌트 생성’을 누르세요.</p>
              </div>
            </div>
          </div>
        )}

        {streaming && <StreamingCard prompt={streaming.prompt} code={streaming.code} />}

        <div className="results-grid">
          {components.map((component) => (
            <ComponentCard
              key={component.id}
              component={component}
              onRemove={removeComponent}
              onRegenerate={handleGenerate}
              onExportGist={exportToGist}
              isLoading={isLoading}
            />
          ))}
        </div>
      </section>

      <footer className="statusbar">
        <span>
          <strong>{activeProvider}</strong> 사용 중 ·{' '}
          {hasEnvKey || apiKey.trim() ? '키 준비됨' : '키 필요'}
        </span>
        <span>Ctrl + Enter로 바로 생성</span>
      </footer>
    </div>
  );
}

export default App;
