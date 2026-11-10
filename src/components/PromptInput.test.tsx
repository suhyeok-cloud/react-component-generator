import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptInput } from './PromptInput';

describe('PromptInput', () => {
  it('프롬프트가 비어 있으면 생성 버튼이 비활성이다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);
    expect(screen.getByRole('button', { name: '컴포넌트 생성' })).toBeDisabled();
  });

  it('입력하면 버튼이 활성화되고 클릭 시 입력값으로 onGenerate가 호출된다', async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<PromptInput onGenerate={onGenerate} isLoading={false} />);

    await user.type(screen.getByRole('textbox'), '프로필 카드');
    const submit = screen.getByRole('button', { name: '컴포넌트 생성' });
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(onGenerate).toHaveBeenCalledWith('프로필 카드');
  });

  it('로딩 중에는 생성 버튼이 비활성이고 "생성 중..." 을 보여준다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={true} />);
    expect(screen.getByRole('button', { name: '생성 중...' })).toBeDisabled();
  });

  describe('프롬프트 히스토리', () => {
    it('히스토리 항목을 클릭하면 입력창에 채워진다', async () => {
      const user = userEvent.setup();
      render(<PromptInput onGenerate={vi.fn()} isLoading={false} history={['로그인 폼', '프로필 카드']} />);

      await user.click(screen.getByRole('button', { name: '프로필 카드' }));

      expect(screen.getByRole('textbox')).toHaveValue('프로필 카드');
    });

    it('히스토리가 없으면 최근 프롬프트 영역을 보여주지 않는다', () => {
      render(<PromptInput onGenerate={vi.fn()} isLoading={false} history={[]} />);

      expect(screen.queryByText('최근 프롬프트')).not.toBeInTheDocument();
    });
  });

  describe('500자 제한', () => {
    const tooLong = '가'.repeat(501);

    it('입력한 글자 수를 최대 글자 수와 함께 보여준다', async () => {
      const user = userEvent.setup();
      render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);

      expect(screen.getByText('0 / 500')).toBeInTheDocument();

      await user.type(screen.getByRole('textbox'), '프로필 카드');

      expect(screen.getByText('6 / 500')).toBeInTheDocument();
    });

    it('500자를 넘기면 에러 메시지를 보여준다', async () => {
      const user = userEvent.setup();
      render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);

      await user.click(screen.getByRole('textbox'));
      await user.paste(tooLong);

      expect(screen.getByRole('alert')).toHaveTextContent(
        '프롬프트는 500자 이하로 입력해주세요. (현재 501자)',
      );
    });

    it('500자를 넘기면 생성 버튼이 비활성이다', async () => {
      const user = userEvent.setup();
      render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);

      await user.click(screen.getByRole('textbox'));
      await user.paste(tooLong);

      expect(screen.getByRole('button', { name: '컴포넌트 생성' })).toBeDisabled();
    });

    it('500자를 넘기면 Ctrl+Enter로도 제출되지 않는다', async () => {
      const onGenerate = vi.fn();
      const user = userEvent.setup();
      render(<PromptInput onGenerate={onGenerate} isLoading={false} />);

      await user.click(screen.getByRole('textbox'));
      await user.paste(tooLong);
      await user.keyboard('{Control>}{Enter}{/Control}');

      expect(onGenerate).not.toHaveBeenCalled();
    });
  });
});
