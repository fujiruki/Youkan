import React from 'react';
import { useJBWOSViewModel } from '../features/core/jbwos/viewmodels/useJBWOSViewModel';
import { HolidayConfigPanel } from '../features/core/settings/HolidayConfigPanel';
import { MigrationWizard } from '../features/core/migration/MigrationWizard';
import { ArrowLeft } from 'lucide-react';

interface SettingsScreenProps {
    onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
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
