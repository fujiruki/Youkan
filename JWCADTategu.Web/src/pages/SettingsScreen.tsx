import React from 'react';
import { useJBWOSViewModel } from '../features/core/jbwos/viewmodels/useJBWOSViewModel';
import { HolidayConfigPanel } from '../features/core/settings/HolidayConfigPanel';
import { MigrationWizard } from '../features/core/migration/MigrationWizard';
import { ArrowLeft } from 'lucide-react';

interface SettingsScreenProps {
    onBack: () => void;
    onNavigateToManual: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack, onNavigateToManual }) => {
    const vm = useJBWOSViewModel();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 lg:p-8">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <ArrowLeft className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                        設定 (Settings)
                    </h1>
                </div>

                {/* Cloud Mode Toggle */}
                <section>
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 px-1">
                        データソース設定
                    </h2>
                    <div className="flex items-center space-x-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <input
                            type="checkbox"
                            id="useCloud"
                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                            defaultChecked={localStorage.getItem('JBWOS_USE_CLOUD') === 'true'}
                            onChange={(e) => {
                                localStorage.setItem('JBWOS_USE_CLOUD', e.target.checked ? 'true' : 'false');
                                window.location.reload();
                            }}
                        />
                        <label htmlFor="useCloud" className="text-slate-700 dark:text-slate-300 font-medium">
                            Cloud APIを使用する (Check to use Server Mode)
                        </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 ml-1">
                        ※ 切り替え後、ページがリロードされます。Migrationが完了していることを確認してください。
                    </p>
                </section>

                {/* Migration Section (Cloud v7) */}
                <section>
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 px-1">
                        データ移行
                    </h2>
                    <MigrationWizard />
                </section>

                {/* Holiday Config Section */}
                <section>
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 px-1">
                        稼働・休業設定
                    </h2>
                    <HolidayConfigPanel
                        config={vm.capacityConfig}
                        onUpdate={vm.updateCapacityConfig}
                    />
                </section>

                {/* Manual Section */}
                <section>
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 px-1">
                        ドキュメント・ヘルプ
                    </h2>
                    <button
                        onClick={onNavigateToManual}
                        className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg text-blue-600 dark:text-blue-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    システム機能説明書
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    ユーザー向けの使い方ガイドと開発者向けドキュメント
                                </p>
                            </div>
                        </div>
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </section>

                {/* Master Management Section (Phase 4) */}
                <section>
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 px-1">
                        マスタ管理
                    </h2>
                    <button
                        onClick={() => window.alert('マスタ管理画面は「プロジェクト > 見積・売上」タブから利用できます。今後、設定画面からのアクセス機能を追加予定です。')}
                        className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg text-amber-600 dark:text-amber-400 text-xl">
                                📦
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                    材料・金物マスタ
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    見積に使用する材料や金物を登録・管理
                                </p>
                            </div>
                        </div>
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </section>

                {/* Other Settings (Placeholder) */}
                <section className="opacity-50 pointer-events-none">
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 px-1">
                        表示設定 (Coming Soon)
                    </h2>
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        Dark Mode / Density
                    </div>
                </section>

            </div>
        </div>
    );
};
