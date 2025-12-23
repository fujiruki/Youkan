import React, { useEffect, useState } from 'react';
import { Project } from '../../db/db';
import { projectRepository } from '../../repositories/ProjectRepository';
import { t } from '../../i18n/labels';
import { GlobalSettingsModal } from '../Settings/GlobalSettingsModal';
import { Folder, Plus, Trash2, Clock, Calendar, Settings } from 'lucide-react';

export const DashboardScreen: React.FC<{ onOpenProject: (p: Project) => void }> = ({ onOpenProject }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const loadProjects = async () => {
        const list = await projectRepository.getAllProjects();
        setProjects(list);
    };

    useEffect(() => { loadProjects(); }, []);

    const handleCreate = async () => {
        const p = await projectRepository.createProjectDraft("New Project");
        const id = await projectRepository.saveProject(p);
        onOpenProject({ ...p, id });
    };

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm(t.dashboard.deleteConfirmProject)) {
            await projectRepository.deleteProject(id);
            loadProjects();
        }
    };

    return (
        <div className="p-8 h-full bg-slate-950 text-slate-200 overflow-y-auto">
            <GlobalSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-emerald-500 flex items-center gap-3">
                    <Folder size={32} />
                    {t.dashboard.title}
                </h1>
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                    title="全体設定"
                >
                    <Settings size={24} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Create Card */}
                <div
                    onClick={handleCreate}
                    className="group border-2 border-dashed border-slate-700/50 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-slate-900/50 transition-all text-slate-500 hover:text-emerald-400 h-48"
                >
                    <div className="bg-slate-800 p-4 rounded-full mb-3 group-hover:bg-emerald-500/20 transition-colors">
                        <Plus size={32} />
                    </div>
                    <span className="font-semibold">{t.dashboard.createNew}</span>
                </div>

                {/* Project Cards */}
                {projects.map(p => (
                    <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative group hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-900/10 transition-all">
                        <div className="cursor-pointer h-full flex flex-col" onClick={() => onOpenProject(p)}>
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-2 bg-emerald-900/30 rounded text-emerald-400">
                                    <Folder size={24} />
                                </div>
                                <button
                                    onClick={(e) => handleDelete(e, p.id!)}
                                    className="text-slate-600 hover:text-red-500 p-2 rounded hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete Project"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <h3 className="text-xl font-bold mb-1 text-slate-200 group-hover:text-emerald-400 transition-colors">{p.name}</h3>
                            <div className="text-sm text-slate-500 mb-4">{p.client || 'Client Name'}</div>

                            <div className="mt-auto pt-4 border-t border-slate-800/50 flex flex-col gap-1 text-xs text-slate-500">
                                <div className="flex items-center gap-2">
                                    <Clock size={12} />
                                    <span>Updated: {p.updatedAt.toLocaleDateString()} {p.updatedAt.toLocaleTimeString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar size={12} />
                                    <span>Created: {p.createdAt.toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
