import React, { useState, useEffect } from 'react';
import { Project, db } from '../../../../db/db';
import { ArrowLeft, FileDown, LayoutDashboard, Settings } from 'lucide-react';

interface JoineryHeaderProps {
    project: Project;
    onBack: () => void;
    onUpdateProject: (p: Project) => void;
    onExportDxf: () => void;
    onSwitchInternal: () => void;
    onOpenSettings: () => void;
    theme?: 'light' | 'dark';
}

export const JoineryHeader: React.FC<JoineryHeaderProps> = ({
    project,
    onBack,
    onUpdateProject,
    onExportDxf,
    onSwitchInternal,
    onOpenSettings,
    theme = 'light'
}) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTableName, setEditTableName] = useState(project.name);

    useEffect(() => {
        setEditTableName(project.name);
    }, [project.name]);

    const handleProjectNameSave = async () => {
        if (editTableName !== project.name) {
            onUpdateProject({ ...project, name: editTableName });
            if (project.id) {
                await db.projects.update(project.id, { name: editTableName });
            }
        }
        setIsEditingTitle(false);
    };

    return (
        <div className="flex justify-between items-start mb-8 shrink-0">
            <div className="flex flex-col gap-2">
                <button
                    onClick={onBack}
                    className="text-slate-500 hover:text-white flex items-center gap-2 text-sm transition-colors mb-1"
                >
                    <ArrowLeft size={16} />
                    プロジェクト一覧に戻る
                </button>
                <div className="flex items-center gap-4">
                    {isEditingTitle ? (
                        <input
                            autoFocus
                            type="text"
                            value={editTableName}
                            onChange={(e) => setEditTableName(e.target.value)}
                            onBlur={handleProjectNameSave}
                            onKeyDown={(e) => e.key === 'Enter' && handleProjectNameSave()}
                            className="bg-slate-800 text-slate-200 px-2 py-1 rounded border border-emerald-500 outline-none w-full max-w-md text-3xl font-bold"
                        />
                    ) : (
                        <h1
                            onClick={() => setIsEditingTitle(true)}
                            className={`text-3xl font-bold cursor-pointer hover:text-emerald-400 transition-colors ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}
                        >
                            {project.name}
                        </h1>
                    )}
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded border border-emerald-500/30">
                        Design Mode
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={onSwitchInternal}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700 font-mono text-sm"
                    title="内部ダッシュボードに戻る"
                >
                    <LayoutDashboard size={16} />
                    Internal
                </button>

                <button
                    onClick={onExportDxf}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                    title="DXF一括出力"
                >
                    <FileDown size={18} />
                </button>

                <button
                    onClick={onOpenSettings}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                    title="プロジェクト設定"
                >
                    <Settings size={20} />
                </button>
            </div>
        </div>
    );
};
