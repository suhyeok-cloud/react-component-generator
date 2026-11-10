import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StreamingCard } from './StreamingCard';

describe('StreamingCard', () => {
  it('프롬프트와 지금까지 받은 코드를 보여준다', () => {
    render(<StreamingCard prompt="파란 버튼" code="const Button = () =>" />);
    expect(screen.getByText('파란 버튼')).toBeInTheDocument();
    expect(screen.getByText('const Button = () =>')).toBeInTheDocument();
  });

  it('코드 탭이 선택되어 있다', () => {
    render(<StreamingCard prompt="파란 버튼" code="" />);
    expect(screen.getByRole('tab', { name: '코드' })).toHaveAttribute('aria-selected', 'true');
  });

  it('생성이 끝나기 전에는 미리보기 탭을 쓸 수 없다', () => {
    render(<StreamingCard prompt="파란 버튼" code="" />);
    expect(screen.getByRole('tab', { name: '미리보기' })).toBeDisabled();
  });
});
