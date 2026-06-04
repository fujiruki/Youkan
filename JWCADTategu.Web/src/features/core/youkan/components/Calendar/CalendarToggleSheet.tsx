import React from 'react';
import { MobileBottomSheet } from '../Common/MobileBottomSheet';
import { CalendarTogglePopover } from './CalendarTogglePopover';
import type { GoogleCalendar } from '../../../../../api/googleCalendar';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    calendars: GoogleCalendar[];
    onToggle: (id: number, isEnabled: boolean) => Promise<void>;
}

/**
 * R-041-Y2: スマホ用ボトムシート。
 * R-033 既存の MobileBottomSheet に CalendarTogglePopover を embedded=true で埋め込む。
 */
export const CalendarToggleSheet: React.FC<Props> = ({ isOpen, onClose, calendars, onToggle }) => {
    return (
        <MobileBottomSheet isOpen={isOpen} onClose={onClose} title="表示するカレンダー">
            <CalendarTogglePopover
                calendars={calendars}
                onToggle={onToggle}
                onClose={onClose}
                embedded
            />
        </MobileBottomSheet>
    );
};
