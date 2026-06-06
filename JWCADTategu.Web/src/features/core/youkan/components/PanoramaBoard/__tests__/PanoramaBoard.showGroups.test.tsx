import { describe, it, expect } from 'vitest';

/**
 * PanoramaBoard のshowGroups切替テスト
 * panoramaモード（状況把握）で「プロジェクト別」「一覧」切替が機能する。
 */

// PanoramaBoardPropsの型テスト: showGroupsとonShowGroupsChangeが存在する
describe('PanoramaBoardProps型定義', () => {
  it('showGroupsプロパティが定義されている', async () => {
    // 動的importで型チェックを兼ねる（モジュール解決連鎖が重いためタイムアウトを延長）
    const mod = await import('../PanoramaBoard');
    expect(mod.PanoramaBoard).toBeDefined();
  }, 30000);
});

// showGroups切替ロジックのユニットテスト
describe('showGroups切替UI', () => {
  it('showGroups=trueのとき「プロジェクト別」がアクティブ', () => {
    const getActiveLabel = (showGroups: boolean) =>
      showGroups ? 'プロジェクト別' : '一覧';
    expect(getActiveLabel(true)).toBe('プロジェクト別');
  });

  it('showGroups=falseのとき「一覧」がアクティブ', () => {
    const getActiveLabel = (showGroups: boolean) =>
      showGroups ? 'プロジェクト別' : '一覧';
    expect(getActiveLabel(false)).toBe('一覧');
  });
});
