import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleCalendarSection } from '../GoogleCalendarSection';
import { GoogleCalendarApi } from '../../../../../../api/googleCalendar';

const showToastMock = vi.fn();
vi.mock('../../../../../../contexts/ToastContext', () => ({
    useToast: () => ({ showToast: showToastMock, toasts: [], dismissToast: vi.fn() }),
}));

describe('GoogleCalendarSection', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        showToastMock.mockReset();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const flushPromises = async () => {
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
    };

    it('未連携時: 説明文と「Google でログイン」ボタンが表示される', async () => {
        vi.spyOn(GoogleCalendarApi, 'getStatus').mockResolvedValue({ connected: false });

        render(<GoogleCalendarSection />);
        await flushPromises();

        expect(screen.getByText(/Google カレンダー連携/)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /Google でログイン/ })
        ).toBeInTheDocument();
    });

    it('「Google でログイン」クリック: startOAuth → window.location.href に authUrl を代入', async () => {
        vi.spyOn(GoogleCalendarApi, 'getStatus').mockResolvedValue({ connected: false });
        const startSpy = vi
            .spyOn(GoogleCalendarApi, 'startOAuth')
            .mockResolvedValue({ authUrl: 'https://accounts.google.com/o/oauth2/auth?xxx' });

        // window.location をモック（href setter を捕捉）
        const originalLocation = window.location;
        const hrefSetter = vi.fn();
        delete (window as any).location;
        (window as any).location = {
            ...originalLocation,
            href: '',
            assign: vi.fn(),
        };
        Object.defineProperty(window.location, 'href', {
            set: hrefSetter,
            get: () => '',
            configurable: true,
        });

        render(<GoogleCalendarSection />);
        await flushPromises();

        fireEvent.click(screen.getByRole('button', { name: /Google でログイン/ }));
        await flushPromises();

        expect(startSpy).toHaveBeenCalled();
        expect(hrefSetter).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/auth?xxx');

        // 復元
        (window as any).location = originalLocation;
    });

    it('連携済み時: メールと最終同期日時、「今すぐ更新」と「連携解除」ボタンが表示される', async () => {
        vi.spyOn(GoogleCalendarApi, 'getStatus').mockResolvedValue({
            connected: true,
            email: 'door.fujita@gmail.com',
            lastSyncAt: Math.floor(Date.now() / 1000) - 60,
        });

        render(<GoogleCalendarSection />);
        await flushPromises();

        expect(screen.getByText('door.fujita@gmail.com')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /今すぐ更新/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /連携解除/ })).toBeInTheDocument();
    });

    it('「今すぐ更新」クリック: refresh 呼び出し → 成功トースト → 60 秒クールダウン', async () => {
        vi.spyOn(GoogleCalendarApi, 'getStatus').mockResolvedValue({
            connected: true,
            email: 'door.fujita@gmail.com',
            lastSyncAt: 1700000000,
        });
        const refreshSpy = vi
            .spyOn(GoogleCalendarApi, 'refresh')
            .mockResolvedValue({ count: 5 });

        render(<GoogleCalendarSection />);
        await flushPromises();

        const refreshBtn = screen.getByRole('button', { name: /今すぐ更新/ });
        fireEvent.click(refreshBtn);
        await flushPromises();

        expect(refreshSpy).toHaveBeenCalled();
        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'success' })
        );

        // クールダウン中: disabled
        const cooldownBtn = screen.getByRole('button', { name: /更新待機中/ });
        expect(cooldownBtn).toBeDisabled();

        // 60 秒経過後: enabled に戻る
        act(() => {
            vi.advanceTimersByTime(60_000);
        });
        await flushPromises();

        expect(screen.getByRole('button', { name: /今すぐ更新/ })).not.toBeDisabled();
    });

    it('「連携解除」クリック: 確認ダイアログ → revoke → 未連携状態に戻る', async () => {
        const getStatusSpy = vi.spyOn(GoogleCalendarApi, 'getStatus');
        getStatusSpy.mockResolvedValueOnce({
            connected: true,
            email: 'door.fujita@gmail.com',
            lastSyncAt: 1700000000,
        });
        const revokeSpy = vi.spyOn(GoogleCalendarApi, 'revoke').mockResolvedValue();
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

        render(<GoogleCalendarSection />);
        await flushPromises();

        fireEvent.click(screen.getByRole('button', { name: /連携解除/ }));
        await flushPromises();
        await flushPromises();

        expect(confirmSpy).toHaveBeenCalled();
        expect(revokeSpy).toHaveBeenCalled();
        expect(
            screen.getByRole('button', { name: /Google でログイン/ })
        ).toBeInTheDocument();
    });

    it('refresh が 429 (クールダウン) の場合: エラートースト', async () => {
        vi.spyOn(GoogleCalendarApi, 'getStatus').mockResolvedValue({
            connected: true,
            email: 'door.fujita@gmail.com',
            lastSyncAt: 1700000000,
        });
        vi.spyOn(GoogleCalendarApi, 'refresh').mockRejectedValue(
            new Error('API Error: 429')
        );

        render(<GoogleCalendarSection />);
        await flushPromises();

        fireEvent.click(screen.getByRole('button', { name: /今すぐ更新/ }));
        await flushPromises();

        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' })
        );
    });

    it('URL に google_oauth=success が含まれる場合: 連携成功トーストを表示', async () => {
        vi.spyOn(GoogleCalendarApi, 'getStatus').mockResolvedValue({
            connected: true,
            email: 'door.fujita@gmail.com',
            lastSyncAt: 1700000000,
        });

        const originalLocation = window.location;
        delete (window as any).location;
        (window as any).location = {
            ...originalLocation,
            search: '?google_oauth=success',
            href: 'http://localhost/?google_oauth=success',
            pathname: '/',
        };

        const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

        render(<GoogleCalendarSection />);
        await flushPromises();

        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'success' })
        );
        expect(replaceStateSpy).toHaveBeenCalled();

        (window as any).location = originalLocation;
    });

    // R-039 Phase 3 UX: 表示するビューの設定セクション
    describe('R-039 Phase 3 UX: 表示するビュー', () => {
        const STORAGE_KEY = 'ykn_external_events_views';

        beforeEach(() => {
            try {
                window.localStorage.removeItem(STORAGE_KEY);
            } catch (_e) { /* noop */ }
        });

        it('連携済み時: グリッド／ガント／タイムラインのチェックボックスが表示され、デフォルトでは全てチェック済み', async () => {
            vi.spyOn(GoogleCalendarApi, 'getStatus').mockResolvedValue({
                connected: true,
                email: 'door.fujita@gmail.com',
                lastSyncAt: 1700000000,
            });

            render(<GoogleCalendarSection />);
            await flushPromises();

            const grid = screen.getByRole('checkbox', { name: /グリッド/ });
            const gantt = screen.getByRole('checkbox', { name: /ガント/ });
            const timeline = screen.getByRole('checkbox', { name: /タイムライン/ });

            expect(grid).toBeChecked();
            expect(gantt).toBeChecked();
            expect(timeline).toBeChecked();
        });

        it('未連携時: 表示するビューのチェックボックスは表示されない', async () => {
            vi.spyOn(GoogleCalendarApi, 'getStatus').mockResolvedValue({ connected: false });

            render(<GoogleCalendarSection />);
            await flushPromises();

            expect(screen.queryByRole('checkbox', { name: /グリッド/ })).toBeNull();
        });

        it('チェックボックスを操作すると localStorage が即時更新される', async () => {
            vi.spyOn(GoogleCalendarApi, 'getStatus').mockResolvedValue({
                connected: true,
                email: 'door.fujita@gmail.com',
                lastSyncAt: 1700000000,
            });

            render(<GoogleCalendarSection />);
            await flushPromises();

            const timeline = screen.getByRole('checkbox', { name: /タイムライン/ });
            fireEvent.click(timeline);
            await flushPromises();

            const saved = window.localStorage.getItem(STORAGE_KEY);
            expect(saved).not.toBeNull();
            const parsed = JSON.parse(saved!);
            expect(parsed).not.toContain('timeline');
            expect(parsed).toContain('grid');
            expect(parsed).toContain('gantt');
        });

        it('localStorage に保存済みの設定がある場合は初期表示に反映される', async () => {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['grid']));
            vi.spyOn(GoogleCalendarApi, 'getStatus').mockResolvedValue({
                connected: true,
                email: 'door.fujita@gmail.com',
                lastSyncAt: 1700000000,
            });

            render(<GoogleCalendarSection />);
            await flushPromises();

            expect(screen.getByRole('checkbox', { name: /グリッド/ })).toBeChecked();
            expect(screen.getByRole('checkbox', { name: /ガント/ })).not.toBeChecked();
            expect(screen.getByRole('checkbox', { name: /タイムライン/ })).not.toBeChecked();
        });
    });
});
