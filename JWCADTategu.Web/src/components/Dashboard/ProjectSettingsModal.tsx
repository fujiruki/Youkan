import React, { useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { Project } from '../../db/db';
import { EstimationSettings, DefaultEstimationSettings } from '../../domain/EstimationSettings';
import { DxfLayerConfig, DEFAULT_DXF_LAYER_CONFIG } from '../../domain/DxfConfig';
import clsx from 'clsx';

interface ProjectSettingsModalProps {
    project: Project;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedProject: Project) => void;
}

type TabType = 'estimation' | 'dxf';

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
    project,
    isOpen,
    onClose,
    onSave
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('estimation');

    // Estimation Settings State
    const [estimationSettings, setEstimationSettings] = useState<EstimationSettings>(
        project.settings || DefaultEstimationSettings
    );

    // DXF Layer Config State
    const [dxfLayerConfig, setDxfLayerConfig] = useState<DxfLayerConfig>(
        project.dxfLayerConfig || DEFAULT_DXF_LAYER_CONFIG
    );

    const handleEstimationChange = (key: keyof EstimationSettings, value: number | string) => {
        setEstimationSettings(prev => ({
            ...prev,
            [key]: typeof value === 'string' ? value : value
        }));
    };

    const handleDxfLayerChange = (key: keyof DxfLayerConfig, value: string) => {
        setDxfLayerConfig(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleResetEstimation = () => {
        setEstimationSettings(DefaultEstimationSettings);
    };

    const handleResetDxfLayers = () => {
        setDxfLayerConfig(DEFAULT_DXF_LAYER_CONFIG);
    };

    const handleSave = () => {
        const updatedProject: Project = {
            ...project,
            settings: estimationSettings,
            dxfLayerConfig: dxfLayerConfig,
            updatedAt: new Date()
        };
        onSave(updatedProject);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-700">
                    <h2 className="text-2xl font-bold text-white">プロジェクト設定</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-1"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-700 px-6">
                    <button
                        onClick={() => setActiveTab('estimation')}
                        className={clsx(
                            "px-4 py-3 font-medium transition-colors border-b-2",
                            activeTab === 'estimation'
                                ? "text-emerald-400 border-emerald-500"
                                : "text-slate-500 border-transparent hover:text-slate-300"
                        )}
                    >
                        積算設定
                    </button>
                    <button
                        onClick={() => setActiveTab('dxf')}
                        className={clsx(
                            "px-4 py-3 font-medium transition-colors border-b-2",
                            activeTab === 'dxf'
                                ? "text-emerald-400 border-emerald-500"
                                : "text-slate-500 border-transparent hover:text-slate-300"
                        )}
                    >
                        DXFレイヤー
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'estimation' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-white">積算設定</h3>
                                <button
                                    onClick={handleResetEstimation}
                                    className="text-sm text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                                >
                                    <RotateCcw size={14} />
                                    デフォルトに戻す
                                </button>
                            </div>

                            {/* Price per m3 */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    立米単価 (円/m³)
                                </label>
                                <input
                                    type="number"
                                    value={estimationSettings.pricePerM3}
                                    onChange={(e) => handleEstimationChange('pricePerM3', Number(e.target.value))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* Markup */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    マークアップ率 (利益率)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={estimationSettings.markup}
                                        onChange={(e) => handleEstimationChange('markup', Number(e.target.value))}
                                        className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                                    />
                                    <span className="text-slate-400 text-sm">
                                        ({(estimationSettings.markup * 100).toFixed(0)}%)
                                    </span>
                                </div>
                            </div>

                            {/* Tax Rate */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    消費税率
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={estimationSettings.taxRate}
                                        onChange={(e) => handleEstimationChange('taxRate', Number(e.target.value))}
                                        className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                                    />
                                    <span className="text-slate-400 text-sm">
                                        ({(estimationSettings.taxRate * 100).toFixed(0)}%)
                                    </span>
                                </div>
                            </div>

                            {/* Margins */}
                            <div className="border-t border-slate-700 pt-4 mt-4">
                                <h4 className="text-md font-semibold text-white mb-3">余裕設定 (mm)</h4>

                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">幅余裕</label>
                                        <input
                                            type="number"
                                            value={estimationSettings.widthMargin}
                                            onChange={(e) => handleEstimationChange('widthMargin', Number(e.target.value))}
                                            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">長さ余裕</label>
                                        <input
                                            type="number"
                                            value={estimationSettings.lengthMargin}
                                            onChange={(e) => handleEstimationChange('lengthMargin', Number(e.target.value))}
                                            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">厚さ余裕</label>
                                        <input
                                            type="number"
                                            value={estimationSettings.thicknessMargin}
                                            onChange={(e) => handleEstimationChange('thicknessMargin', Number(e.target.value))}
                                            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Hozo Length */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    ホゾ長さ（片側、mm）
                                </label>
                                <input
                                    type="number"
                                    value={estimationSettings.hozoLength}
                                    onChange={(e) => handleEstimationChange('hozoLength', Number(e.target.value))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'dxf' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-white">DXFレイヤー設定</h3>
                                <button
                                    onClick={handleResetDxfLayers}
                                    className="text-sm text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                                >
                                    <RotateCcw size={14} />
                                    デフォルトに戻す
                                </button>
                            </div>

                            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4">
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    レイヤー名はJWCAD形式（例: 0-2）で指定してください。<br />
                                    グループ番号-レイヤー番号 の形式です。
                                </p>
                            </div>

                            {/* Joinery Outline */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    建具枠線（輪郭）
                                </label>
                                <input
                                    type="text"
                                    value={dxfLayerConfig.joineryOutline}
                                    onChange={(e) => handleDxfLayerChange('joineryOutline', e.target.value)}
                                    placeholder="0-2"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* Joinery Fill */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    建具塗りつぶし（SOLID）
                                </label>
                                <input
                                    type="text"
                                    value={dxfLayerConfig.joineryFill}
                                    onChange={(e) => handleDxfLayerChange('joineryFill', e.target.value)}
                                    placeholder="0-E"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* Dimensions */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    寸法図形
                                </label>
                                <input
                                    type="text"
                                    value={dxfLayerConfig.dimensions}
                                    onChange={(e) => handleDxfLayerChange('dimensions', e.target.value)}
                                    placeholder="8-F"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* Text */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    テキスト情報
                                </label>
                                <input
                                    type="text"
                                    value={dxfLayerConfig.text}
                                    onChange={(e) => handleDxfLayerChange('text', e.target.value)}
                                    placeholder="8-0"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* Frame */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    全体枠線
                                </label>
                                <input
                                    type="text"
                                    value={dxfLayerConfig.frame}
                                    onChange={(e) => handleDxfLayerChange('frame', e.target.value)}
                                    placeholder="8-1"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-slate-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium transition-colors"
                    >
                        保存
                    </button>
                </div>
            </div>
        </div>
    );
};
