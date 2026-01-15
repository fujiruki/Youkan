import React, { useState, useEffect } from 'react';
import { EstimationSettings, DefaultEstimationSettings } from '../../features/plugins/tategu/domain/EstimationSettings';
import { X, Save } from 'lucide-react';

interface GlobalSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState<EstimationSettings>(DefaultEstimationSettings);

    useEffect(() => {
        if (isOpen) {
            const saved = localStorage.getItem('globalEstimationSettings');
            if (saved) {
                try {
                    setSettings(JSON.parse(saved));
                } catch (e) {
                    console.error("Failed to parse settings", e);
                }
            }
        }
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem('globalEstimationSettings', JSON.stringify(settings));
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl animate-fade-in p-6">
                <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                    <h2 className="text-xl font-bold text-white">全体設定 (Global Settings)</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-sm font-bold text-emerald-400 mb-2">デフォルト単価設定</h3>
                        <p className="text-xs text-slate-500 mb-4">新規案件作成時の初期値として使用されます。</p>

                        <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-slate-300">基準 立米単価 (Price/m³)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-slate-500">¥</span>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 pl-7 text-white outline-none focus:border-emerald-500 transition-colors"
                                        value={settings.pricePerM3}
                                        onChange={e => setSettings({ ...settings, pricePerM3: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-sm text-slate-300">掛率 / 利益率 (Markup)</label>
                                <input
                                    type="number" step="0.05"
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white outline-none focus:border-emerald-500 transition-colors"
                                    value={settings.markup}
                                    onChange={e => setSettings({ ...settings, markup: Number(e.target.value) })}
                                />
                                <div className="text-xs text-slate-500 text-right">0.2 = 20% Markup</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-bold text-amber-400 mb-2">タスク見積設定</h3>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm text-slate-300">1日の標準稼働時間 (Hours/Day)</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                className="w-24 bg-slate-800 border border-slate-700 rounded p-2 text-white outline-none focus:border-amber-500 transition-colors"
                                value={settings.hoursPerDay || 7}
                                onChange={e => setSettings({ ...settings, hoursPerDay: Number(e.target.value) })}
                            />
                            <span className="text-slate-500 text-sm">時間</span>
                        </div>
                        <p className="text-xs text-slate-500">「1日」と入力した際の計算基準になります (例: 7h × 60min = 420min)</p>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2 rounded text-slate-400 hover:bg-slate-800 transition-colors">
                    キャンセル
                </button>
                <button onClick={handleSave} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/20">
                    <Save size={18} />
                    保存する
                </button>
            </div>
        </div>
    );
};
