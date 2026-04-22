import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useFilter, FilterProvider } from '../FilterContext';

beforeEach(() => {
    localStorage.clear();
});

// useFilter が値を返すことを検証するコンポーネント
const FilterModeDisplay = () => {
    const { filterMode } = useFilter();
    return <div data-testid="filter-mode">{filterMode}</div>;
};

// setFilterMode を呼び出すコンポーネント
const FilterModeSetter = ({ mode }: { mode: string }) => {
    const { setFilterMode } = useFilter();
    return (
        <button
            data-testid="set-button"
            onClick={() => setFilterMode(mode as any)}
        >
            Set
        </button>
    );
};

// Provider 外で useFilter を呼ぶコンポーネント
const OutsideConsumer = () => {
    useFilter();
    return null;
};

describe('FilterContext', () => {
    describe('FilterProvider 内で useFilter を使う', () => {
        it('FilterProvider でラップすると useFilter が filterMode を返す', () => {
            render(
                <FilterProvider>
                    <FilterModeDisplay />
                </FilterProvider>
            );
            expect(screen.getByTestId('filter-mode')).toBeInTheDocument();
        });

        it('初期 filterMode は "all"（localStorage 未設定時）', () => {
            render(
                <FilterProvider>
                    <FilterModeDisplay />
                </FilterProvider>
            );
            expect(screen.getByTestId('filter-mode').textContent).toBe('all');
        });

        it('setFilterMode で filterMode が更新される', async () => {
            const { getByTestId } = render(
                <FilterProvider>
                    <FilterModeDisplay />
                    <FilterModeSetter mode="company" />
                </FilterProvider>
            );
            expect(getByTestId('filter-mode').textContent).toBe('all');
            await act(async () => {
                getByTestId('set-button').click();
            });
            expect(getByTestId('filter-mode').textContent).toBe('company');
        });

        it('setFilterMode すると localStorage に保存される', async () => {
            const { getByTestId } = render(
                <FilterProvider>
                    <FilterModeSetter mode="personal" />
                </FilterProvider>
            );
            await act(async () => {
                getByTestId('set-button').click();
            });
            expect(localStorage.getItem('youkan_filter_mode')).toBe('personal');
        });

        it('localStorage に値があれば初期値としてその値が使われる', () => {
            localStorage.setItem('youkan_filter_mode', 'company');
            render(
                <FilterProvider>
                    <FilterModeDisplay />
                </FilterProvider>
            );
            expect(screen.getByTestId('filter-mode').textContent).toBe('company');
        });
    });

    describe('FilterProvider 外で useFilter を呼ぶ', () => {
        it('Provider 外で useFilter を呼ぶとエラーをスローする', () => {
            const originalError = console.error;
            console.error = () => {};
            expect(() => render(<OutsideConsumer />)).toThrow();
            console.error = originalError;
        });
    });
});
