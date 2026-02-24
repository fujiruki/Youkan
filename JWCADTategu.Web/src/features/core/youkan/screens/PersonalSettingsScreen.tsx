import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../core/auth/providers/AuthProvider';
import { ApiClient } from '../../../../api/client';
import { YOUKAN_KEYS } from '../../session/youkanKeys';
import { useToast } from '../../../../contexts/ToastContext';
import { ArrowLeft, Save, Lock, User, Clock, AlertTriangle, FileJson, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { ItemsBackupSettings } from '../components/Settings/ItemsBackupSettings';
// [PRESERVED] スライダーUI版（復旧用）: import { WeeklyPatternEditor } from '../components/Settings/WeeklyPatternEditor';
import { CapacityTableEditor } from '../components/Settings/CapacityTableEditor';
import { CapacityProfile, WeeklyPattern, WeeklyCompanyPattern } from '../types';

interface PersonalSettingsScreenProps {
	onBack: () => void;
}

export const PersonalSettingsScreen: React.FC<PersonalSettingsScreenProps> = ({ onBack }) => {
	const { checkAuth, joinedTenants: authJoinedTenants } = useAuth();
	const { showToast } = useToast();
	const [isLoading, setIsLoading] = useState(false);

	// Profile State
	const [displayName, setDisplayName] = useState('');
	const [email, setEmail] = useState('');
	const [birthday, setBirthday] = useState('');

	// Capacity State
	const [dailyCapacity, setDailyCapacity] = useState(480); // minutes
	const [nonWorkingHours, setNonWorkingHours] = useState('');
	const [capacityProfile, setCapacityProfile] = useState<CapacityProfile>({
		standardWeeklyPattern: { 1: 480, 2: 480, 3: 480, 4: 480, 5: 480 },
		exceptions: {}
	});
	const [showWeeklyEditor, setShowWeeklyEditor] = useState(false);

	// Password State
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');

	// Confirm State
	const [isConfirming, setIsConfirming] = useState(false);

	// Backup Modal State
	const [showBackupModal, setShowBackupModal] = useState(false);

	// Motivation Quotes State
	const [motivationQuotes, setMotivationQuotes] = useState('');

	// App Settings
	const [showLifeMode, setShowLifeMode] = useState(() => {
		return localStorage.getItem(YOUKAN_KEYS.SHOW_LIFE_MODE) !== 'false';
	});

	useEffect(() => {
		loadProfile();
	}, []);

	const loadProfile = async () => {
		try {
			setIsLoading(true);
			const profile = await ApiClient.getUserProfile();
			setDisplayName(profile.display_name || '');
			setEmail(profile.email || '');
			setBirthday(profile.birthday || '');
			setDailyCapacity(profile.daily_capacity_minutes || 480);

			// Handle JSON or string for non_working_hours
			let nwh = profile.non_working_hours;
			if (nwh === null || nwh === 'null') {
				nwh = '';
			} else if (typeof nwh !== 'string') {
				nwh = JSON.stringify(nwh, null, 2);
			}
			setNonWorkingHours(nwh || '');

			// Handle preferences (Motivation Quotes & Capacity Profile)
			const prefs = profile.preferences ? (typeof profile.preferences === 'string' ? JSON.parse(profile.preferences) : profile.preferences) : {};
			setMotivationQuotes(prefs.motivation_quotes || '');

			if (prefs.capacity_profile) {
				setCapacityProfile(prefs.capacity_profile);
			}
		} catch (error) {
			console.error('Failed to load profile', error);
			showToast({ type: 'error', title: 'エラー', message: 'プロフィールの読み込みに失敗しました' });
		} finally {
			setIsLoading(false);
		}
	};

	const handleSaveProfile = async () => {
		try {
			setIsLoading(true);
			// Validate JSON if not empty
			let parsedNwh = nonWorkingHours;
			if (nonWorkingHours.trim()) {
				try {
					parsedNwh = JSON.parse(nonWorkingHours);
				} catch (e) {
					showToast({ type: 'error', title: '保存エラー', message: '定休日・祝日のJSON形式が正しくありません' });
					return;
				}
			}

			// Handle preferences
			const currentProfile = await ApiClient.getUserProfile();
			const prefs = currentProfile.preferences ? (typeof currentProfile.preferences === 'string' ? JSON.parse(currentProfile.preferences) : currentProfile.preferences) : {};
			prefs.motivation_quotes = motivationQuotes;
			prefs.capacity_profile = capacityProfile;

			await ApiClient.updateUserProfile({
				display_name: displayName,
				birthday: birthday,
				daily_capacity_minutes: dailyCapacity,
				non_working_hours: parsedNwh,
				preferences: prefs
			});
			await checkAuth(); // Refresh global auth state

			// Save local settings
			localStorage.setItem(YOUKAN_KEYS.SHOW_LIFE_MODE, showLifeMode.toString());

			showToast({ type: 'success', title: '保存完了', message: 'プロフィールを更新しました' });
		} catch (error) {
			console.error(error);
			showToast({ type: 'error', title: 'エラー', message: 'プロフィールの保存に失敗しました' });
		} finally {
			setIsLoading(false);
		}
	};

	const handleChangePassword = async () => {
		if (!currentPassword || !newPassword) {
			showToast({ type: 'error', title: 'エラー', message: 'パスワードを入力してください' });
			return;
		}
		try {
			setIsLoading(true);
			await ApiClient.changePassword(currentPassword, newPassword);
			setCurrentPassword('');
			setNewPassword('');
			showToast({ type: 'success', title: '成功', message: 'パスワードを変更しました' });
		} catch (error: any) {
			console.error(error);
			showToast({ type: 'error', title: 'エラー', message: error.message || 'パスワードの変更に失敗しました' });
		} finally {
			setIsLoading(false);
		}
	};

	if (isLoading && !email) {
		return <div className="p-8 text-slate-500">設定を読み込み中...</div>;
	}

	return (
		<div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
			{/* Header */}
			<div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
				<div className="flex items-center gap-4">
					<button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
						<ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
					</button>
					<h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
						<User className="w-6 h-6 text-indigo-500" />
						個人設定
					</h1>
				</div>
				<button
					onClick={handleSaveProfile}
					disabled={isLoading}
					className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm transition-all disabled:opacity-50"
				>
					<Save className="w-4 h-4" />
					変更を保存
				</button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full space-y-8">

				{/* Profile Section */}
				<section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
					<h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
						基本情報
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div className="space-y-2">
							<label className="text-sm font-medium text-slate-600 dark:text-slate-400">表示名 (Display Name)</label>
							<input
								type="text"
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
								className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
								placeholder="氏名を入力"
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium text-slate-600 dark:text-slate-400">メールアドレス</label>
							<input
								type="email"
								value={email}
								disabled
								className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
							/>
							<p className="text-xs text-slate-400">メールアドレスは変更できません。</p>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium text-slate-600 dark:text-slate-400">誕生日</label>
							<input
								type="date"
								value={birthday}
								onChange={(e) => setBirthday(e.target.value)}
								className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
							/>
						</div>
					</div>
				</section>

				{/* App Settings Section */}
				<section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
					<h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
						<Settings className="w-5 h-5 text-slate-500" />
						システム表示設定
					</h2>
					<div className="space-y-4">
						<div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
							<div>
								<h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">個人用 (Life) モードの導線を表示</h3>
								<p className="text-xs text-slate-500 mt-1">メニューに「社内モード」への切り替えボタンを表示します。</p>
							</div>
							<button
								onClick={() => setShowLifeMode(!showLifeMode)}
								className={`w-12 h-6 rounded-full transition-colors relative ${showLifeMode ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
							>
								<div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${showLifeMode ? 'translate-x-6' : 'translate-x-0'}`} />
							</button>
						</div>
						<p className="text-[10px] text-slate-400">※ 法人利用に特化したい場合はオフにすることで、メニューをシンプルにできます。</p>
					</div>
				</section>

				{/* Capacity Section (Restored) */}
				<section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
					<h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Clock className="w-5 h-5 text-indigo-500" />
							業務キャパシティ設定
						</div>
						<button
							onClick={() => setShowWeeklyEditor(!showWeeklyEditor)}
							className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1"
						>
							{showWeeklyEditor ? (
								<>
									詳細設定を閉じる
									<ChevronUp size={14} />
								</>
							) : (
								<>
									曜日別・会社別設定を開く
									<ChevronDown size={14} />
								</>
							)}
						</button>
					</h2>

					<div className="space-y-6">
						{!showWeeklyEditor ? (
							<div className="space-y-4">
								<div className="space-y-2">
									<label className="text-sm font-medium text-slate-600 dark:text-slate-400">
										デフォルトの1日の業務可能時間 (分)
									</label>
									<div className="flex items-center gap-4">
										<input
											type="number"
											value={dailyCapacity}
											onChange={(e) => setDailyCapacity(Number(e.target.value))}
											className="w-32 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
										/>
										<span className="text-slate-500 dark:text-slate-400 text-sm">
											{(dailyCapacity / 60).toFixed(1)} 時間
										</span>
									</div>
									<p className="text-xs text-slate-400">特定の曜日設定がない場合の基本値として使用されます。</p>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium text-slate-600 dark:text-slate-400">
										定休日・祝日設定 (Advanced JSON)
									</label>
									<textarea
										value={nonWorkingHours}
										onChange={(e) => setNonWorkingHours(e.target.value)}
										rows={2}
										className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-sm"
										placeholder='{"weekends": ["Sat", "Sun"], "holidays": []}'
									/>
								</div>
							</div>
						) : (
							<div className="animate-in fade-in slide-in-from-top-2 duration-300">
								{/* [TABLE UI] 表形式エディタ */}
								<CapacityTableEditor
									standardWeeklyPattern={capacityProfile.standardWeeklyPattern}
									companyWeeklyPattern={capacityProfile.defaultCompanyWeeklyPattern}
									tenants={(authJoinedTenants || []).map(t => ({ id: t.id, name: t.name }))}
									onChange={(standard: WeeklyPattern, company: WeeklyCompanyPattern) => {
										setCapacityProfile({
											...capacityProfile,
											standardWeeklyPattern: standard,
											defaultCompanyWeeklyPattern: company
										});
									}}
								/>
								{/* [PRESERVED] スライダーUI版（復旧用）
                                <WeeklyPatternEditor
                                    initialPattern={capacityProfile.standardWeeklyPattern}
                                    initialCompanyPattern={capacityProfile.defaultCompanyWeeklyPattern}
                                    joinedTenants={authJoinedTenants || []}
                                    onSave={(standard: WeeklyPattern, company: WeeklyCompanyPattern) => {
                                        setCapacityProfile({
                                            ...capacityProfile,
                                            standardWeeklyPattern: standard,
                                            defaultCompanyWeeklyPattern: company
                                        });
                                        setShowWeeklyEditor(false);
                                    }}
                                    onCancel={() => setShowWeeklyEditor(false)}
                                />
                                */}
								<p className="mt-4 text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
									※ 曜日ごとの配分を設定することで、カレンダー上での「目安期間（キャパシティ）」が動的に計算されます。
									未設定の曜日は上記のデフォルト時間（{dailyCapacity}分）が適用されます。
								</p>
							</div>
						)}
					</div>
				</section>

				{/* Motivation Quotes Section */}
				<section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
					<h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
						<Save className="w-5 h-5 text-emerald-500" />
						好きな言葉集（モチベーター）
					</h2>
					<div className="space-y-4">
						<p className="text-sm text-slate-500 dark:text-slate-400">
							自分がやる気になる言葉を1つ1行で入力してください。システムを開くたびに、ランダムな言葉が背景に浮かび上がります。
						</p>
						<textarea
							value={motivationQuotes}
							onChange={(e) => setMotivationQuotes(e.target.value)}
							rows={6}
							className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300"
							placeholder={"一歩ずつ進もう\n今日できることをやる\n完璧よりもまず完成させよう"}
						/>
						<p className="text-xs text-slate-400">※ 入力した言葉は、作業の邪魔にならないように画面背景にひっそりと表示されます。</p>
					</div>
				</section>
				<section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
					<h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
						<Lock className="w-5 h-5 text-slate-500" />
						セキュリティ
					</h2>
					<div className="space-y-4 max-w-md">
						<div className="space-y-2">
							<label className="text-sm font-medium text-slate-600 dark:text-slate-400">現在のパスワード</label>
							<input
								type="password"
								value={currentPassword}
								onChange={(e) => setCurrentPassword(e.target.value)}
								className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium text-slate-600 dark:text-slate-400">新しいパスワード</label>
							<input
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
							/>
						</div>
						<button
							onClick={handleChangePassword}
							disabled={isLoading || !currentPassword || !newPassword}
							className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg font-medium shadow-sm transition-all disabled:opacity-50 text-sm"
						>
							パスワードを変更
						</button>
					</div>
				</section>

				{/* Data Backup Section */}
				<section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
					<h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
						<FileJson className="w-5 h-5 text-blue-500" />
						データのバックアップ
					</h2>
					<p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
						あなたのアイテムデータをJSON形式でエクスポート・インポートできます。
					</p>
					<button
						onClick={() => setShowBackupModal(true)}
						className="px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg font-medium transition-all text-sm flex items-center gap-2"
					>
						<FileJson size={16} />
						バックアップを管理
					</button>
				</section>

				{/* Danger Zone */}
				<section className="bg-red-50 dark:bg-red-900/10 rounded-xl shadow-sm border border-red-200 dark:border-red-900/30 p-6 transition-all">
					<h2 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-4 pb-2 border-b border-red-100 dark:border-red-900/20 flex items-center gap-2">
						<AlertTriangle className="w-5 h-5" />
						危険な操作
					</h2>
					<div className="space-y-4">
						<div>
							<p className="text-sm text-red-700 dark:text-red-300 font-medium mb-1">登録データの全削除</p>
							<p className="text-xs text-red-600 dark:text-red-400 opacity-80">
								あなたが登録したすべてのタスク、プロジェクト、サブタスクが物理的に削除されます。<br />
								この操作は取り消すことができません。
							</p>
						</div>
						{!isConfirming ? (
							<button
								onClick={() => setIsConfirming(true)}
								disabled={isLoading}
								className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-sm transition-all disabled:opacity-50 text-sm"
							>
								すべてのデータを削除する
							</button>
						) : (
							<div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
								<button
									onClick={async () => {
										try {
											setIsLoading(true);
											const res = await ApiClient.clearAllItems();
											showToast({
												type: 'success',
												title: '削除完了',
												message: `${res.count} 個のアイテムを削除しました。`
											});
											setTimeout(() => window.location.reload(), 1500);
										} catch (error: any) {
											console.error(error);
											showToast({ type: 'error', title: 'エラー', message: 'データの削除に失敗しました' });
											setIsConfirming(false);
										} finally {
											setIsLoading(false);
										}
									}}
									disabled={isLoading}
									className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold shadow-lg transition-all animate-pulse"
								>
									本当に削除する（実行）
								</button>
								<button
									onClick={() => setIsConfirming(false)}
									className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
								>
									キャンセル
								</button>
								<span className="text-xs text-red-500 font-medium">← 最終確認：クリックで実行</span>
							</div>
						)}
					</div>
				</section>

			</div>

			{/* Backup Modal */}
			{showBackupModal && (
				<ItemsBackupSettings onClose={() => setShowBackupModal(false)} />
			)}
		</div>
	);
};
