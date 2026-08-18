import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DateBandNode } from '../DateBandNode';

// R-148: 帯ラベル行の先頭に案件名1語（灰字・同サイズ・折返しなし・長ければ省略）
const renderBand = (data: Record<string, unknown>) =>
  render(<DateBandNode {...({ data } as any)} />);

describe('DateBandNode (R-148 案件名ラベル)', () => {
  const base = { label: '8/16(日)まで', totalMinutes: 180, criticalMinutes: 180, remainingMinutes: 180, hasIncomplete: true };

  it('projectName があると帯ラベル行の先頭に案件名が灰字・truncate で入る', () => {
    renderBand({ ...base, projectName: '案件P1' });
    const name = screen.getByText('案件P1');
    expect(name.className).toContain('text-slate-400');
    expect(name.className).toContain('truncate');
    const row = name.parentElement as HTMLElement;
    expect(row.textContent).toBe('案件P18/16(日)まで');
    expect(row.className).toContain('whitespace-nowrap');
    expect(row.className).toContain('text-[13px]');
  });

  it('projectName が無ければ従来どおり日付ラベルのみ', () => {
    renderBand(base);
    expect(screen.getByText('8/16(日)まで')).toBeInTheDocument();
    expect(screen.queryByText('案件P1')).toBeNull();
  });
});
