import React from 'react';
import { useJBWOSViewModel } from '../features/core/jbwos/viewmodels/useJBWOSViewModel';
import { HolidayConfigPanel } from '../features/core/settings/HolidayConfigPanel';
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
