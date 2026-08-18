import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReviewPrompt } from '../ReviewPrompt';
import { YOUKAN_KEYS, YOUKAN_EVENTS } from '../../../../session/youkanKeys';

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

    it('ボタンが［はじめる］［後で（1時間後）］［今日はやめる］の順で並ぶ', () => {
        render(<ReviewPrompt count={5} today={TODAY} onStart={vi.fn()} />);
        const buttons = screen.getAllByRole('button');
        expect(buttons.map(b => b.textContent)).toEqual(['はじめる', '後で（1時間後）', '今日はやめる']);
    });
});

describe('ReviewPrompt - R-134 後で（1時間後）とスヌーズ再表示', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('「後で（1時間後）」を押すとsnooze_untilに現在時刻+60分を保存し、非表示になる', () => {
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
        render(<ReviewPrompt count={5} today={TODAY} onStart={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: '後で（1時間後）' }));

        expect(localStorage.getItem(YOUKAN_KEYS.REVIEW_PROMPT_SNOOZE_UNTIL)).toBe(String(1_000_000 + 60 * 60 * 1000));
        expect(screen.queryByTestId('review-prompt')).toBeNull();
        nowSpy.mockRestore();
    });

    it('60分経過すると同一セッション内で再表示される', () => {
        vi.useFakeTimers();
        render(<ReviewPrompt count={5} today={TODAY} onStart={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: '後で（1時間後）' }));
        expect(screen.queryByTestId('review-prompt')).toBeNull();

        act(() => {
            vi.advanceTimersByTime(60 * 60 * 1000);
        });

        expect(screen.getByTestId('review-prompt')).toBeInTheDocument();
    });

    it('リロード時、snooze_untilを過ぎていれば表示する', () => {
        localStorage.setItem(YOUKAN_KEYS.REVIEW_PROMPT_SNOOZE_UNTIL, String(Date.now() - 1000));
        render(<ReviewPrompt count={5} today={TODAY} onStart={vi.fn()} />);
        expect(screen.getByTestId('review-prompt')).toBeInTheDocument();
    });

    it('リロード時、snooze_untilが未来なら非表示のまま', () => {
        localStorage.setItem(YOUKAN_KEYS.REVIEW_PROMPT_SNOOZE_UNTIL, String(Date.now() + 60 * 60 * 1000));
        render(<ReviewPrompt count={5} today={TODAY} onStart={vi.fn()} />);
        expect(screen.queryByTestId('review-prompt')).toBeNull();
    });

    it('初回の「後で」押下でNotification.requestPermissionを1回だけ要求し、以後は聞かない', () => {
        const requestPermission = vi.fn();
        vi.stubGlobal('Notification', class {
            static permission = 'default';
            static requestPermission = requestPermission;
        });

        const { unmount } = render(<ReviewPrompt count={5} today={TODAY} onStart={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: '後で（1時間後）' }));
        expect(requestPermission).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem(YOUKAN_KEYS.REVIEW_NOTIFY_ASKED)).toBe('1');
        unmount();

        localStorage.removeItem(YOUKAN_KEYS.REVIEW_PROMPT_SNOOZE_UNTIL);
        render(<ReviewPrompt count={5} today={TODAY} onStart={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: '後で（1時間後）' }));
        expect(requestPermission).toHaveBeenCalledTimes(1);
    });

    it('通知許可済みなら60分後に1回だけ通知を出し、クリックでReviewSweepを開くフラグを立てる', () => {
        vi.useFakeTimers();

        const instances: { title: string; onclick: (() => void) | null }[] = [];
        class NotificationMock {
            static permission = 'granted';
            static requestPermission = vi.fn();
            onclick: (() => void) | null = null;
            title: string;
            constructor(title: string) {
                this.title = title;
                instances.push(this);
            }
        }
        vi.stubGlobal('Notification', NotificationMock);

        const focusSpy = vi.spyOn(window, 'focus').mockImplementation(() => { });

        render(<ReviewPrompt count={7} today={TODAY} onStart={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: '後で（1時間後）' }));

        act(() => {
            vi.advanceTimersByTime(60 * 60 * 1000);
        });

        expect(instances).toHaveLength(1);
        expect(instances[0].title).toBe('後でと言っていた要判断 7件、今は？');

        instances[0].onclick?.();

        expect(focusSpy).toHaveBeenCalled();
        expect(sessionStorage.getItem(YOUKAN_KEYS.REVIEW_SWEEP_PENDING)).toBe('1');
        focusSpy.mockRestore();
    });

    it('Notification未定義の環境でも「後で」押下でエラーにならない', () => {
        vi.stubGlobal('Notification', undefined);
        render(<ReviewPrompt count={5} today={TODAY} onStart={vi.fn()} />);
        expect(() => {
            fireEvent.click(screen.getByRole('button', { name: '後で（1時間後）' }));
        }).not.toThrow();
    });
});
