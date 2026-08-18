import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ReviewPrompt } from '../ReviewPrompt';
import { YOUKAN_KEYS } from '../../../../session/youkanKeys';

const TODAY = '2026-08-18';

describe('ReviewPrompt', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('件数が0のときは何も表示しない', () => {
        render(<ReviewPrompt count={0} today={TODAY} onStart={vi.fn()} />);
        expect(screen.queryByTestId('review-prompt')).toBeNull();
    });

    it('件数が0より大きく、当日未dismissなら誘導文言を表示する', () => {
        render(<ReviewPrompt count={5} today={TODAY} onStart={vi.fn()} />);
        expect(screen.getByText(/要判断\s*5\s*件/)).toBeInTheDocument();
        expect(screen.getByText(/3件だけ、1分で捌く/)).toBeInTheDocument();
    });

    it('localStorageの当日dismissフラグがあれば表示しない', () => {
        localStorage.setItem(YOUKAN_KEYS.REVIEW_PROMPT_DISMISSED, TODAY);
        render(<ReviewPrompt count={5} today={TODAY} onStart={vi.fn()} />);
        expect(screen.queryByTestId('review-prompt')).toBeNull();
    });

    it('dismissフラグが前日以前なら当日は表示する', () => {
        localStorage.setItem(YOUKAN_KEYS.REVIEW_PROMPT_DISMISSED, '2026-08-17');
        render(<ReviewPrompt count={5} today={TODAY} onStart={vi.fn()} />);
        expect(screen.getByTestId('review-prompt')).toBeInTheDocument();
    });

    it('「今日はやめる」を押すとlocalStorageに当日日付を保存し非表示になる', () => {
        render(<ReviewPrompt count={5} today={TODAY} onStart={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: '今日はやめる' }));
        expect(localStorage.getItem(YOUKAN_KEYS.REVIEW_PROMPT_DISMISSED)).toBe(TODAY);
        expect(screen.queryByTestId('review-prompt')).toBeNull();
    });

    it('「はじめる」を押すとonStartが呼ばれ、非表示になる（localStorageは変更しない）', () => {
        const onStart = vi.fn();
        render(<ReviewPrompt count={5} today={TODAY} onStart={onStart} />);
        fireEvent.click(screen.getByRole('button', { name: 'はじめる' }));
        expect(onStart).toHaveBeenCalled();
        expect(localStorage.getItem(YOUKAN_KEYS.REVIEW_PROMPT_DISMISSED)).toBeNull();
        expect(screen.queryByTestId('review-prompt')).toBeNull();
    });
});
