import React, { useEffect, useState } from 'react';
import { Project } from '../../db/db';
import { projectRepository } from '../../repositories/ProjectRepository';
import { t } from '../../i18n/labels';
import { GlobalSettingsModal } from '../Settings/GlobalSettingsModal';
import { Folder, Plus, Trash2, Clock, Calendar, Settings, BookTemplate, LayoutList, KanbanSquare } from 'lucide-react'; // [NEW] Icons
import { ScheduleBoard } from './ScheduleBoard';
import { FieldNoteList } from './FieldNoteList'; // [NEW]

export const DashboardScreen: React.FC<{ onOpenProject: (p: Project) => void; onOpenCatalog: () => void }> = ({ onOpenProject, onOpenCatalog }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'projects' | 'schedule'>('projects');

    // Project Detail View State
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [activeProjectTab, setActiveProjectTab] = useState<'doors' | 'notes'>('doors'); // [NEW]

    // Override onOpenProject to just set local state for Detail View if strict separation isn't needed
    // However, the prop onOpenProject suggests the parent handles navigation?
    // Let's assume onOpenProject navigates to Editor?
    // Wait, Editor is for Door. "Project View" is usually Dashboard's responsibility?
    // Currently, App.tsx handles routing.
    // If I want to show "Project Details" inside Dashboard, I need to intercept the click.
    // But Step 646 Verification flow showed clicking a Project card opens the Door list?
    // Let's check how onOpenProject is used.
    // Step 754: <div onClick={() => onOpenProject(p)}>
    // This calls parent's handler. 
    // I should probably NOT modify DashboardScreen to handle Project Selection internally if the architecture uses App.tsx routing.
    // BUT the requirement says "DashboardScreen... Project Details view".
    // If onOpenProject changes the screen to "ProjectDetailScreen", I should mod that file.
    // But there is no ProjectDetailScreen. App.tsx probably switches to 'project' mode?
    // Let's assume I need to handle it IN Dashboard or verify App.tsx.

    // Let's modify onOpenProject usage. Since I can't see App.tsx, I'll stick to the Plan: "DashboardScreen... Tab Navigation: [Doors] [Field Notes]".
    // This implies DashboardScreen handles the view?
    // Or maybe I should check App.tsx?
    // I'll assume DashboardScreen *is* the container.
    // Wait, the current code just calls `onOpenProject`. 
    // If I want to add tabs, I likely need to intercept this.

    // Actually, looking at previous logs/code, AppScreen management is likely handling this.
    // I risk breaking navigation if I change `onOpenProject`.
    // BUT the Plan says: "When selectedProject is active: Tab Navigation".
    // This implies there IS a state where a project is selected.
    // The current `DashboardScreen` (Step 754) DOES NOT have `selectedProject` state. It just lists projects.

    // Hypothesis: Clicking a project currently goes to a different screen (ProjectScreen?).
    // I should check `App.tsx` or `ProjectScreen.tsx` (if exists).
    // `find_by_name` for *Screen.tsx?

    const loadProjects = async () => {
        const list = await projectRepository.getAllProjects();
        setProjects(list);
    };

    useEffect(() => { loadProjects(); }, []);

    const handleCreate = async () => {
        console.log('[Dashboard] Create Clicked');
        try {
            const p = await projectRepository.createProjectDraft("New Project");
            console.log('[Dashboard] Draft created, saving...');
            const id = await projectRepository.saveProject(p);
            console.log('[Dashboard] Project Saved ID:', id);
            onOpenProject({ ...p, id });
        } catch (e) {
            console.error('[Dashboard] Create Failed', e);
        }
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

                <div className="flex items-center gap-2">
                    {/* Tab Switcher */}
                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 mr-4">
                        <button
                            onClick={() => setActiveTab('projects')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'projects' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            <LayoutList size={16} />
                            Projects
                        </button>
                        <button
                            onClick={() => setActiveTab('schedule')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === 'schedule' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            <KanbanSquare size={16} />
                            Schedule
                        </button>
                    </div>

                    <button
                        onClick={onOpenCatalog}
                        className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 text-sm font-bold border border-slate-700"
                    >
                        <BookTemplate size={18} />
                        Catalog
                    </button>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                        title="全体設定"
                    >
                        <Settings size={24} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'schedule' ? (
                <ScheduleBoard />
            ) : (
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
            )}
        </div>
    );
};
