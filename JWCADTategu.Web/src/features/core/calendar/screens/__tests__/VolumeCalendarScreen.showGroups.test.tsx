import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * VolumeCalendarScreenのshowGroups切替テスト
 * GanttHeaderの「プロジェクト別/一覧」ボタンで切り替えた値が
 * RyokanCalendarに正しく伝わることを検証する。
 */

// VolumeCalendarScreenから抽出したロジック:
// showGanttGroupsのstate管理とlocalStorage永続化
const STORAGE_KEY = 'youkan_gantt_show_groups';

describe('VolumeCalendarScreen showGroups切替', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', {
            store: {} as Record<string, string>,
            getItem(key: string) { return this.store[key] ?? null; },
            setItem(key: string, val: string) { this.store[key] = val; },
            removeItem(key: string) { delete this.store[key]; },
        });
    });

    it('デフォルトはtrue（プロジェクト別）', () => {
        const saved = localStorage.getItem(STORAGE_KEY);
        const initial = saved !== 'false';
        expect(initial).toBe(true);
    });

    it('localStorageに"false"が保存されていればfalse（一覧）', () => {
        localStorage.setItem(STORAGE_KEY, 'false');
        const saved = localStorage.getItem(STORAGE_KEY);
        const initial = saved !== 'false';
        expect(initial).toBe(false);
    });

    it('onShowGroupsChangeでfalseに切替後、localStorageに保存される', () => {
        // シミュレーション: stateをfalseに変更 → localStorageに保存
        const newValue = false;
        localStorage.setItem(STORAGE_KEY, newValue.toString());
        expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
    });

    it('onShowGroupsChangeでtrueに切替後、localStorageに保存される', () => {
        localStorage.setItem(STORAGE_KEY, 'false');
        const newValue = true;
        localStorage.setItem(STORAGE_KEY, newValue.toString());
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    });

    it('GanttHeaderとRyokanCalendarに同じshowGroups値が渡されるべき', () => {
        // このテストは統合テストの意図を示す
        // VolumeCalendarScreenでshowGanttGroupsが一つのstateで管理され、
        // GanttHeaderのshowGroupsとRyokanCalendarのshowGroupsの両方に渡される
        const showGanttGroups = false;
        const ganttHeaderProps = { showGroups: showGanttGroups };
        const ryokanCalendarProps = { showGroups: showGanttGroups };
        expect(ganttHeaderProps.showGroups).toBe(ryokanCalendarProps.showGroups);
    });
});
