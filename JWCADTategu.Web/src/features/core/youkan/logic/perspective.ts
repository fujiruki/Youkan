import { FilterMode, Perspective } from '../types';

/**
 * 現在の状態（アカウント属性、選択テナント、フィルタ）から、
 * 「立場 (Perspective)」と「立場ラベル (PerspectiveLabel)」を算出する
 */
export const calculatePerspective = (
	isCompanyContext: boolean, // [CHANGED] use context instead of account type
	filterMode: FilterMode
): { perspective: Perspective; perspectiveLabel: string } => {
	if (!isCompanyContext) {
		// --- コンテキスト：個人 ---
		// コンテキストが個人の場合、「自分の時間管理」に固定
		return {
			perspective: 'personal_private',
			perspectiveLabel: '自分の時間管理'
		};
	} else {
		// --- ログイン種別：会社 ---
		if (filterMode === 'personal') {
			// ⑥ 社内事務
			return {
				perspective: 'company_internal',
				perspectiveLabel: '自分の時間管理' // ユーザーに合わせて「自分の時間管理」に統一
			};
		} else {
			// ⑤ 事業全体（特定フィルタ中も含む）
			return {
				perspective: 'company_business',
				perspectiveLabel: '事業の管理'
			};
		}
	}
};
