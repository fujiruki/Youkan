import { describe, it, expect } from 'vitest';
import { decisionToStatus } from '../decisionResolution';

// R-124: yes/hold/断る の判定結果をstatusへ変換する共通ロジックのテスト。
// 従来は画面ごとに個別実装されており、
// - FlowScreen.tsx: 「保留にする」(hold) が三項演算子の握りつぶしで「断る」(no) 扱いになるバグ
// - useYoukanViewModel.resolveDecision: 「断る」(no) が status:'done'（完了）になるバグ
// - RyokanGanttView.tsx: 「断る」ボタンが status:'done' を直接書き込むバグ
// があった。共通関数に一本化し、上記3つの誤りが起きないことを保証する。
describe('decisionToStatus', () => {
    it('yesはfocusになる', () => {
        expect(decisionToStatus('yes')).toBe('focus');
    });

    it('holdはpendingになる（断る/cancelledにはならない）', () => {
        // FlowScreen.tsxの旧バグ（hold→noへの握りつぶし）の再現防止
        expect(decisionToStatus('hold')).toBe('pending');
        expect(decisionToStatus('hold')).not.toBe('cancelled');
    });

    it('noはcancelledになる（done/decision_rejectedにはならない）', () => {
        // useYoukanViewModel.resolveDecisionの旧バグ（no→done）、
        // RyokanGanttView.tsxの旧バグ（断る→done直接書き込み）の再現防止
        expect(decisionToStatus('no')).toBe('cancelled');
        expect(decisionToStatus('no')).not.toBe('done');
    });

    it('noでnoteがsomeday/intentのときは保留棚(pending)へ退避する（既存の特殊ルート）', () => {
        expect(decisionToStatus('no', 'someday')).toBe('pending');
        expect(decisionToStatus('no', 'intent')).toBe('pending');
    });

    it('noでnoteがhistory（通常の断る操作）のときはcancelledになる', () => {
        expect(decisionToStatus('no', 'history')).toBe('cancelled');
    });
});
