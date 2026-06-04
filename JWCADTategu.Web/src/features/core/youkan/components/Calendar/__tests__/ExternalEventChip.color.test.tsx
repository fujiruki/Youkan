import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExternalEventChip } from '../ExternalEventChip';
import { ExternalEvent } from '../../../types/externalEvent';

const baseEvent: ExternalEvent = {
    id: 'google:colorEvt',
    calendarId: 'primary',
    eventId: 'colorEvt',
    startAt: new Date('2026-06-04T09:30:00').getTime() / 1000,
    endAt: new Date('2026-06-04T10:30:00').getTime() / 1000,
    allDay: false,
    title: 'カラー会議',
    location: null,
    htmlLink: null,
};

describe('ExternalEventChip カラー反映（R-041-Y3）', () => {
    it('colorHex を渡したとき tint 背景と左ボーダー色が style に反映される', () => {
        render(<ExternalEventChip event={baseEvent} colorHex="#4285F4" />);
        const el = screen.getByRole('button') as HTMLButtonElement;
        // tint 背景（10% 不透明度の rgba）
        expect(el.style.backgroundColor).toBe('rgba(66, 133, 244, 0.1)');
        // 左ボーダー色は colorHex そのもの
        expect(el.style.borderLeftColor).toBe('rgb(66, 133, 244)');
    });

    it('点線ボーダー（border-dashed）クラスが付与されている', () => {
        render(<ExternalEventChip event={baseEvent} colorHex="#4285F4" />);
        const el = screen.getByRole('button');
        expect(el.className).toMatch(/border-dashed/);
    });
});
