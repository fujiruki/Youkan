import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { PersonalSettingsScreen } from '../PersonalSettingsScreen';

// R-130: 「定休日・祝日設定 (Advanced JSON)」欄は死に設定だったため廃止し、
// F-11の決定規則を説明する文言に置き換える。

vi.mock('@/api/client', () => ({
    ApiClient: {
        getUserProfile: vi.fn(() => Promise.resolve({
            id: 'u1',
            email: 'test@example.com',
            display_name: 'テスト太郎',
            birthday: '',
            daily_capacity_minutes: 480,
            non_working_hours: null,
            preferences: {},
        })),
        updateUserProfile: vi.fn(() => Promise.resolve({ success: true })),
        // R-140: ApiTokenSection の一覧取得（GET /user/api-tokens）
        request: vi.fn(() => Promise.resolve([])),
    },
}));

vi.mock('@/features/core/auth/providers/AuthProvider', () => ({
    useAuth: vi.fn(() => ({
        checkAuth: vi.fn(),
        joinedTenants: [],
    })),
}));

vi.mock('@/contexts/ToastContext', () => ({
    useToast: vi.fn(() => ({
        showToast: vi.fn(),
        toasts: [],
        dismissToast: vi.fn(),
    })),
}));

describe('PersonalSettingsScreen (R-130)', () => {
    it('「定休日・祝日設定 (Advanced JSON)」欄が存在しない', async () => {
        render(<PersonalSettingsScreen onBack={() => {}} />);
        await waitFor(() => expect(screen.getByDisplayValue('テスト太郎')).toBeInTheDocument());
        expect(screen.queryByText(/Advanced JSON/)).not.toBeInTheDocument();
    });

    it('日次キャパの決定規則の説明文が表示される', async () => {
        render(<PersonalSettingsScreen onBack={() => {}} />);
        await waitFor(() => expect(screen.getByDisplayValue('テスト太郎')).toBeInTheDocument());
        expect(screen.getByText(/曜日パターンで0＝定休日。未設定なら土日休み。日別例外が最優先です。/)).toBeInTheDocument();
    });
});
