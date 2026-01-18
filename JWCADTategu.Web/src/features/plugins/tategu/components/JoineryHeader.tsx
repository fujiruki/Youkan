import React, { useState, useEffect } from 'react';
import { Project, db } from '../../../../db/db';
import { ArrowLeft, Trash2, FileDown, LayoutDashboard, Settings } from 'lucide-react';

interface JoineryHeaderProps {
    project: Project;
    onBack: () => void;
    onUpdateProject: (p: Project) => void;
    onDeleteProject: (id: number) => void;
    onExportDxf: () => void;
    onSwitchInternal: () => void;
    onOpenSettings: () => void;
}

export const JoineryHeader: React.FC<JoineryHeaderProps> = ({
    project,
    onBack,
    onUpdateProject,
    onDeleteProject,
    onExportDxf,
    onSwitchInternal,
    onOpenSettings
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

    const handleArchiveProject = async () => {
        if (confirm('このプロジェクトをアーカイブしますか？\n（プロジェクト一覧で非表示になりますが、検索は可能です - 機能未実装）')) {
            onUpdateProject({ ...project, isArchived: true });
            alert('アーカイブしました');
            onBack();
        }
    };

    const handleDeleteProjectAction = () => {
        if (confirm('【危険】プロジェクトを削除しますか？\nこの操作は取り消せません。\n含まれる全ての建具データも削除されます。')) {
            onDeleteProject(project.id!);
        }
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
                            className="text-3xl font-bold text-white cursor-pointer hover:text-emerald-400 transition-colors"
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

                <div className="dropdown dropdown-end">
                    <button tabIndex={0} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <Trash2 size={20} />
                    </button>
                    <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-slate-800 rounded-box w-52 border border-slate-700">
                        <li>
                            <a onClick={handleArchiveProject} className="text-amber-400 hover:text-amber-300">
                                アーカイブ
                            </a>
                        </li>
                        <li>
                            <a onClick={handleDeleteProjectAction} className="text-red-400 hover:text-red-300">
                                プロジェクト削除
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
