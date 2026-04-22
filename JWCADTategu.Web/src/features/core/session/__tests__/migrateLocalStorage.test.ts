import { describe, it, expect, beforeEach } from 'vitest';
import { migrateLocalStorage } from '../migrateLocalStorage';

const SCHEMA_KEY = 'youkan_schema_version';
const VIEW_MODE_KEY = 'youkan_view_mode';

beforeEach(() => {
    localStorage.clear();
});

describe('migrateLocalStorage', () => {
    describe('初回実行（schemaVersion なし）', () => {
        it('youkan_view_mode="board" → "panorama" に書き換わる', () => {
            localStorage.setItem(VIEW_MODE_KEY, 'board');
            migrateLocalStorage();
            expect(localStorage.getItem(VIEW_MODE_KEY)).toBe('panorama');
        });

        it('youkan_view_mode="newspaper" → "overview" に書き換わる', () => {
            localStorage.setItem(VIEW_MODE_KEY, 'newspaper');
            migrateLocalStorage();
            expect(localStorage.getItem(VIEW_MODE_KEY)).toBe('overview');
        });

        it('youkan_newspaper_fontsize の値が youkan_overview_fontsize にコピーされ、旧キーが削除される', () => {
            localStorage.setItem('youkan_newspaper_fontsize', '14');
            migrateLocalStorage();
            expect(localStorage.getItem('youkan_overview_fontsize')).toBe('14');
            expect(localStorage.getItem('youkan_newspaper_fontsize')).toBeNull();
        });

        it('youkan_newspaper_columns の値が youkan_overview_columns にコピーされ、旧キーが削除される', () => {
            localStorage.setItem('youkan_newspaper_columns', '3');
            migrateLocalStorage();
            expect(localStorage.getItem('youkan_overview_columns')).toBe('3');
            expect(localStorage.getItem('youkan_newspaper_columns')).toBeNull();
        });

        it('youkan_newspaper_title_limit の値が youkan_overview_title_limit にコピーされ、旧キーが削除される', () => {
            localStorage.setItem('youkan_newspaper_title_limit', '50');
            migrateLocalStorage();
            expect(localStorage.getItem('youkan_overview_title_limit')).toBe('50');
            expect(localStorage.getItem('youkan_newspaper_title_limit')).toBeNull();
        });

        it('既に youkan_overview_fontsize に値がある場合は上書きしない', () => {
            localStorage.setItem('youkan_newspaper_fontsize', '14');
            localStorage.setItem('youkan_overview_fontsize', '16');
            migrateLocalStorage();
            expect(localStorage.getItem('youkan_overview_fontsize')).toBe('16');
        });

        it('完了後 youkan_schema_version が "2" になる', () => {
            migrateLocalStorage();
            expect(localStorage.getItem(SCHEMA_KEY)).toBe('2');
        });
    });

    describe('冪等性', () => {
        it('schemaVersion === "2" の状態で再度呼ぶと何もしない', () => {
            localStorage.setItem(SCHEMA_KEY, '2');
            localStorage.setItem(VIEW_MODE_KEY, 'board');
            migrateLocalStorage();
            expect(localStorage.getItem(VIEW_MODE_KEY)).toBe('board');
        });

        it('schemaVersion === "3" など未来バージョンなら何もしない', () => {
            localStorage.setItem(SCHEMA_KEY, '3');
            localStorage.setItem(VIEW_MODE_KEY, 'board');
            migrateLocalStorage();
            expect(localStorage.getItem(VIEW_MODE_KEY)).toBe('board');
        });
    });
});
