/**
 * R-073: SmartDateInput ブラー時の意図しない onChange 発火防止テスト
 *
 * 既存値と同じ文字列のままブラーした場合、onChange が呼ばれないことを検証する。
 * 実際に日付を変更してブラーした場合は、従来通り onChange が呼ばれることも確認する。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SmartDateInput } from '../SmartDateInput';

describe('SmartDateInput — ブラー時の差分チェック (R-073)', () => {
    it('既存値と同じ文字列のままブラーしても onChange は呼ばれない', () => {
        const onChange = vi.fn();
        const value = new Date(2026, 6, 31); // 2026/07/31

        render(<SmartDateInput value={value} onChange={onChange} />);

        const input = screen.getByPlaceholderText("YYYY/MM/DD or 'tomorrow'");

        fireEvent.focus(input);
        fireEvent.blur(input);

        expect(onChange).not.toHaveBeenCalled();
    });

    it('実際に日付を変更してブラーすると onChange が新しい日付で呼ばれる', () => {
        const onChange = vi.fn();
        const value = new Date(2026, 6, 31); // 2026/07/31

        render(<SmartDateInput value={value} onChange={onChange} />);

        const input = screen.getByPlaceholderText("YYYY/MM/DD or 'tomorrow'");

        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: '2026/08/15' } });
        fireEvent.blur(input);

        expect(onChange).toHaveBeenCalledTimes(1);
        const calledDate = onChange.mock.calls[0][0] as Date;
        expect(calledDate.getFullYear()).toBe(2026);
        expect(calledDate.getMonth()).toBe(7); // 8月 = index 7
        expect(calledDate.getDate()).toBe(15);
    });

    it('値が未設定の状態から空文字のままブラーしても onChange は呼ばれない', () => {
        const onChange = vi.fn();

        render(<SmartDateInput value={null} onChange={onChange} />);

        const input = screen.getByPlaceholderText("YYYY/MM/DD or 'tomorrow'");

        fireEvent.focus(input);
        fireEvent.blur(input);

        expect(onChange).not.toHaveBeenCalled();
    });

    it('既存値がある状態で空文字にしてブラーすると onChange(null) が呼ばれる（クリア操作）', () => {
        const onChange = vi.fn();
        const value = new Date(2026, 6, 31);

        render(<SmartDateInput value={value} onChange={onChange} />);

        const input = screen.getByPlaceholderText("YYYY/MM/DD or 'tomorrow'");

        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: '' } });
        fireEvent.blur(input);

        expect(onChange).toHaveBeenCalledWith(null);
    });
});
