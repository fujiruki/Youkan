import { FilterMode, Perspective, JoinedTenant } from '../types';

/**
 * 現在の状態（アカウント属性、選択テナント、フィルタ）から、
 * 「立場 (Perspective)」と「立場ラベル (PerspectiveLabel)」を算出する
 */
export const calculatePerspective = (
	isCompanyAccount: boolean,
	filterMode: FilterMode,
	joinedTenants: JoinedTenant[]
): { perspective: Perspective; perspectiveLabel: string } => {
	// 特定テナントが選択されているか確認
	const activeTenant = joinedTenants.find(t => t.id === filterMode);

	if (!isCompanyAccount) {
		// --- ログイン種別：個人 ---
		if (activeTenant) {
			// ④ 特定社管理
			return {
				perspective: 'personal_company',
				perspectiveLabel: `${activeTenant.name}マネージャーとして`
			};
		} else if (filterMode === 'company') {
			// ③ 会社横断
			return {
				perspective: 'personal_company',
				perspectiveLabel: '会社業務の俯瞰'
			};
		} else {
			// ① 個人・統合 または ② 個人・専念
			return {
				perspective: 'personal_private',
				perspectiveLabel: '自分の時間管理'
			};
		}
	} else {
		// --- ログイン種別：会社 ---
		if (filterMode === 'personal') {
			// ⑥ 社内事務
			return {
				perspective: 'company_internal',
				perspectiveLabel: '社内業務の管理'
			};
		} else {
			// ⑤ 事業全体
			const label = activeTenant ? `${activeTenant.name}の管理` : '事業の管理';
			return {
				perspective: 'company_business',
				perspectiveLabel: label
			};
		}
	}
};
