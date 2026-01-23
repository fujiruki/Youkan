import React, { useState } from 'react';
import { useJBWOSViewModel } from '../features/core/jbwos/viewmodels/useJBWOSViewModel';
import { useLoginViewModel } from '../features/core/auth/hooks/useLoginViewModel';
import { HolidayConfigPanel } from '../features/core/settings/HolidayConfigPanel';
import { MigrationWizard } from '../features/core/migration/MigrationWizard';
import { CompanyProfileForm } from '../features/core/settings/components/CompanyProfileForm';
import { MemberManagement } from '../features/core/settings/components/MemberManagement';
import { useAuth } from '../features/core/auth/providers/AuthProvider';
import { JbwosTenant } from '../features/core/auth/types';
import { ArrowLeft, Building, Users, Settings, Smartphone, LogOut } from 'lucide-react'; // Added icons

interface SettingsScreenProps {
    onBack: () => void;
    onNavigateToManual: () => void;
}

type TabType = 'company' | 'members' | 'system';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack, onNavigateToManual }) => {
    const vm = useJBWOSViewModel();
    const { tenant, user } = useAuth();
    const { logout } = useLoginViewModel();
    const [activeTab, setActiveTab] = useState<TabType>('company');

    // Mock save handler
    const handleCompanySave = (updated: JbwosTenant) => {
        console.log('Saving tenant config:', updated);
        window.alert('会社情報を保存しました (Mock)');
    };

    const tabs = [
        { id: 'company', label: '会社情報', icon: Building },
        { id: 'members', label: 'メンバー', icon: Users },
        { id: 'system', label: 'システム設定', icon: Settings },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <ArrowLeft className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                            設定 (Settings)
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {tenant?.name || 'My Company'} の設定と管理
                        </p>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as TabType)}
                                    className={`
                                        group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                                        ${isActive
                                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}
                                    `}
                                >
                                    <Icon
                                        className={`
                                            -ml-0.5 mr-2 h-5 w-5
                                            ${isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500'}
                                        `}
                                    />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Content Area */}
                <div className="mt-6">
                    {/* Tab: Company Info */}
                    {activeTab === 'company' && tenant && (
                        <div className="animate-fade-in">
                            <CompanyProfileForm
                                tenant={tenant as JbwosTenant}
                                onSave={handleCompanySave}
                            />
                        </div>
                    )}

                    {/* Tab: Members */}
                    {activeTab === 'members' && user && (
                        <div className="animate-fade-in">
                            <MemberManagement currentUser={user} />
                        </div>
                    )}

                    {/* Tab: System Settings (Legacy content) */}
                    {activeTab === 'system' && (
                        <div className="space-y-8 animate-fade-in">

                            {/* Cloud Mode Toggle */}
                            <section>
                                <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 px-1">
                                    データソース設定
                                </h2>
                                <div className="flex items-center space-x-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
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
                                    <label htmlFor="useCloud" className="text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                                        Cloud APIを使用する (Check to use Server Mode)
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500 mt-2 ml-1">
                                    ※ 切り替え後、ページがリロードされます。Migrationが完了していることを確認してください。
                                </p>
                            </section>

                            {/* Holiday Config Section */}
                            <section>
                                <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 px-1">
                                    稼働・休業設定
                                </h2>
                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                                    <HolidayConfigPanel
                                        config={vm.capacityConfig}
                                        onUpdate={vm.updateCapacityConfig}
                                    />
                                </div>
                            </section>

                            {/* Migration Section (Cloud v7) */}
                            <section>
                                <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 px-1">
                                    データ移行
                                </h2>
                                <MigrationWizard />
                            </section>

                            {/* Manual Section */}
                            <section>
                                <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-4 px-1">
                                    ドキュメント・ヘルプ
                                </h2>
                                <button
                                    onClick={onNavigateToManual}
                                    className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group shadow-sm"
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
                                    className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group shadow-sm"
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
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <Smartphone size={20} />
                                        <span>Dark Mode / Density Settings</span>
                                    </div>
                                </div>
                            </section>

                            {/* Logout Section */}
                            <section className="pt-6 border-t border-slate-200 dark:border-slate-800">
                                <h2 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4 px-1">
                                    ログアウト
                                </h2>
                                <button
                                    onClick={() => {
                                        if (window.confirm('ログアウトしますか？')) {
                                            logout();
                                        }
                                    }}
                                    className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group shadow-sm"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
                                            <LogOut size={20} />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                                                ログアウトする
                                            </h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                アカウントからサインアウトし、ログイン画面に戻ります
                                            </p>
                                        </div>
                                    </div>
                                    <ArrowLeft className="w-5 h-5 text-slate-400 rotate-180 group-hover:text-red-400 transition-colors" />
                                </button>
                            </section>

                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
