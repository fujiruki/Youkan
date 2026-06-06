import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HealthCheck } from '../HealthCheck';
import { ApiClient } from '../../../../../../api/client';

describe('R-048: HealthCheck 起動時 API 抑制', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(ApiClient, 'getHealth').mockResolvedValue({
            status: 'ok',
            php: { version: '8.2.0' },
            database: { status: 'connected', item_count: 42 },
            server: { protocol: 'HTTP/1.1' }
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('マウント直後に ApiClient.getHealth が呼ばれない', () => {
        render(<HealthCheck />);
        expect(ApiClient.getHealth).not.toHaveBeenCalled();
    });

    it('60 秒経過しても自動ポーリングで getHealth が呼ばれない', () => {
        render(<HealthCheck />);
        vi.advanceTimersByTime(60_000);
        expect(ApiClient.getHealth).not.toHaveBeenCalled();
    });

    it('System Status ボタン押下時に getHealth が 1 回呼ばれる', () => {
        vi.useRealTimers();
        const { container } = render(<HealthCheck />);
        const button = container.querySelector('button[title="System Status: Operational"]');
        expect(button).not.toBeNull();
        fireEvent.click(button!);
        expect(ApiClient.getHealth).toHaveBeenCalledTimes(1);
    });
});
