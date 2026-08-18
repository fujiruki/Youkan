import { JudgmentStatus } from '../types';

export type Decision = 'yes' | 'hold' | 'later' | 'no';

/**
 * R-124: yes/hold/断る の判定結果を実際のstatusへ変換する共通ロジック。
 * 従来は画面（状況把握・全体一覧・フロー・ガント・カレンダー）ごとに
 * 個別実装されており、「保留」を「断る」に握りつぶす、「断る」を「完了」扱いにする等の
 * 不整合バグの原因になっていた。「断る」操作は全画面で必ずこの関数を経由し、
 * 同じ状態（cancelled）を書き込むようにする。
 *
 * R-125: 判断モーダルに「後日着手」ボタンを追加。'later' は「やると決めたが今日はやらない」
 * 状態（todo）へ遷移する。
 */
export function decisionToStatus(decision: Decision, note?: string): JudgmentStatus {
    if (decision === 'yes') return 'focus';
    if (decision === 'later') return 'todo';
    if (decision === 'hold') return 'pending';
    // 'no'（断る）: いつかやる・保留棚への退避は例外的に保留(pending)へ
    if (note === 'someday' || note === 'intent') return 'pending';
    return 'cancelled';
}
