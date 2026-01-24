import React from 'react';
import { Package, Hammer, AlertTriangle } from 'lucide-react';
import { JbwosTenant, TenantConfig } from '../../auth/types';

interface PluginManagementProps {
    tenant: JbwosTenant;
    onUpdate: (updatedConfig: TenantConfig) => void;
}

export const PluginManagement: React.FC<PluginManagementProps> = ({ tenant, onUpdate }) => {
    // Current config or default
    const config = tenant.config || { plugins: { manufacturing: false, tategu: false } };

    const handleToggle = (pluginKey: 'manufacturing' | 'tategu') => {
        const newPlugins = { ...config.plugins };

        if (pluginKey === 'manufacturing') {
            newPlugins.manufacturing = !newPlugins.manufacturing;
            // If manufacturing is turned off, force tategu off
            if (!newPlugins.manufacturing) {
                newPlugins.tategu = false;
            }
        }
        else if (pluginKey === 'tategu') {
            // Can only turn on if manufacturing is on
            if (!newPlugins.manufacturing && !newPlugins.tategu) {
                alert('建具プラグインを使用するには、先に製造業プラグインを有効にしてください。');
                return;
            }
            newPlugins.tategu = !newPlugins.tategu;
        }

        onUpdate({ ...config, plugins: newPlugins });
    };

    return (
        <div className="space-y-6">
            <header className="mb-6">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Package className="text-indigo-500" />
                    機能管理 (Plugin Management)
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    会社全体で利用する機能をON/OFFします。ここでの設定はすべての社員に適用されます。
                </p>
            </header>

            <div className="grid gap-4">
                {/* Manufacturing Plugin */}
                <div className={`
                    p-6 rounded-xl border-2 transition-all
                    ${config.plugins.manufacturing
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}
                `}>
                    <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                            <div className={`
                                p-3 rounded-lg flex items-center justify-center
                                ${config.plugins.manufacturing ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}
                            `}>
                                <Hammer size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                                    製造業プラグイン
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                                    案件（Project）に「製造」の概念を導入します。
                                    工場設定、工程管理、成果物タブなどが利用可能になります。
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={config.plugins.manufacturing}
                                onChange={() => handleToggle('manufacturing')}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>
                </div>

                {/* Tategu Plugin */}
                <div className={`
                    p-6 rounded-xl border-2 transition-all
                    ${config.plugins.tategu
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/10'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}
                    ${!config.plugins.manufacturing ? 'opacity-50 grayscale' : ''}
                `}>
                    <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                            <div className={`
                                p-3 rounded-lg flex items-center justify-center
                                ${config.plugins.tategu ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}
                            `}>
                                <Package size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                                    建具専用プラグイン
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                                    建具の見積作成、詳細図面エディタ、建具表出力機能を提供します。
                                    <span className="block mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                        ※ 製造業プラグインが必要です
                                    </span>
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={config.plugins.tategu}
                                onChange={() => handleToggle('tategu')}
                                disabled={!config.plugins.manufacturing}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-500"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Impact Warning */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex gap-3 text-sm text-blue-700 dark:text-blue-300">
                <AlertTriangle className="shrink-0" size={20} />
                <p>
                    機能をOFFにすると、関連するプロジェクトデータ（建具表など）は削除されませんが、
                    アクセスできなくなります。再度ONにするとデータは復元されます。
                </p>
            </div>
        </div>
    );
};
