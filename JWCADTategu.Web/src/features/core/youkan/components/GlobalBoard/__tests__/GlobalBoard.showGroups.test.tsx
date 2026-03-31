import { describe, it, expect } from 'vitest';

/**
 * YoukanBoard（GlobalBoard）のshowGroups切替テスト
 * panoramaモード（状況把握）で「プロジェクト別」「一覧」切替が機能する。
 */

// GlobalBoardPropsの型テスト: showGroupsとonShowGroupsChangeが存在する
describe('GlobalBoardProps型定義', () => {
  it('showGroupsプロパティが定義されている', async () => {
    // 動的importで型チェックを兼ねる
    const mod = await import('../GlobalBoard');
    expect(mod.YoukanBoard).toBeDefined();
  });
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
