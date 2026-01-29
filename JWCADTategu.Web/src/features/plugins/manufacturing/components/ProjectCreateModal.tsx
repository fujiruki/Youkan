import React, { useState } from 'react';
import { X, Building, MapPin, FileText, Plus, Target, Palette } from 'lucide-react';

interface ProjectCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: any) => void;
    activeTab: 'personal' | 'company';
}

const COLORS = [
    { name: 'Default', value: '#e2e8f0' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Sky', value: '#0ea5e9' },
];

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({
    isOpen,
    onClose,
    onCreate,
    activeTab
}) => {
    const [title, setTitle] = useState('');
    const [clientName, setClientName] = useState('');
    const [siteName, setSiteName] = useState('');
    const [grossProfitTarget, setGrossProfitTarget] = useState<number>(0);
    const [color, setColor] = useState(COLORS[0].value);
    const [memo, setMemo] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        onCreate({
            title,
            clientName: activeTab === 'company' ? clientName : null,
            siteName: activeTab === 'company' ? siteName : null,
            grossProfitTarget: activeTab === 'company' ? grossProfitTarget : 0,
            color,
            memo,
            projectType: activeTab === 'company' ? 'mfg' : 'general',
            status: 'inbox',
            isProject: true
        });

        // Reset
        setTitle('');
        setClientName('');
        setSiteName('');
        setGrossProfitTarget(0);
        setColor(COLORS[0].value);
        setMemo('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
                    <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Plus size={20} className="text-indigo-600" />
                        {activeTab === 'personal' ? '新規プロジェクト（個人）' : '新規プロジェクト（仕事）'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">プロジェクト名（必須）</label>
                        <input
                            required
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="例: 佐藤邸 建具工事"
                            autoFocus
                        />
                    </div>

                    {/* Color Picker */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                            <Palette size={12} /> カラーラベル
                        </label>
                        <div className="flex gap-2">
                            {COLORS.map((c) => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => setColor(c.value)}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${color === c.value ? 'border-slate-800 scale-110 shadow-sm' : 'border-transparent hover:scale-105'}`}
                                    style={{ backgroundColor: c.value }}
                                    title={c.name}
                                />
                            ))}
                        </div>
                    </div>

                    {activeTab === 'company' && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                                        <Building size={12} className="inline mr-1" /> 元請（顧客名）
                                    </label>
                                    <input
                                        type="text"
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="株式会社〇〇"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                                        <MapPin size={12} className="inline mr-1" /> 現場名
                                    </label>
                                    <input
                                        type="text"
                                        value={siteName}
                                        onChange={(e) => setSiteName(e.target.value)}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="〇〇様邸 現場"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                                    <Target size={12} className="inline mr-1" /> 目標粗利額 (円)
                                </label>
                                <input
                                    type="number"
                                    value={grossProfitTarget}
                                    onChange={(e) => setGrossProfitTarget(Number(e.target.value))}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="50000"
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                            <FileText size={12} className="inline mr-1" /> メモ / 備考
                        </label>
                        <textarea
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-16 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                            placeholder="自由なメモ..."
                        />
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors shadow-lg shadow-slate-200"
                        >
                            作成する
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
