import React, { useState } from 'react';
import { Plus, ArrowRight, FileText, Edit2, Building, Home } from 'lucide-react';
import { ApiClient } from '../../../../api/client';
import { useProjectListViewModel } from '../../manufacturing/viewmodels/useProjectListViewModel';
import { ProjectCreateModal } from '../../manufacturing/components/ProjectCreateModal';

interface ProjectListScreenProps {
    onSelectProject: (projectId: number) => void;
    onNavigateHome: () => void;
}

export const ProjectListScreen: React.FC<ProjectListScreenProps> = ({
    onSelectProject,
    onNavigateHome
}) => {
    const {
        activeTab,
        setTab,
        projects,
        loading,
        refresh
    } = useProjectListViewModel();

    const [isCreating, setIsCreating] = useState(false);

    const handleCreateProject = async (data: any) => {
        try {
            await ApiClient.createItem(data);
            setIsCreating(false);
            refresh();
        } catch (error) {
            console.error('Failed to create project:', error);
            window.alert('Failed to create project: ' + error);
        }
    };

    const ProjectCard = ({ project }: { project: any }) => (
        <div
            className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            onClick={() => onSelectProject(project.id!)}
        >
            <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-slate-700 group-hover:text-indigo-600 transition-colors">
                    {project.title || project.name}
                </h3>
                <button className="text-slate-300 hover:text-slate-500">
                    <Edit2 size={16} />
                </button>
            </div>

            <div className="text-sm text-slate-500 space-y-2">
                <div className="flex items-center gap-2">
                    <FileText size={14} />
                    <span>Project ({project.project_type || 'general'})</span>
                </div>
                {project.tenant_name && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        {project.tenant_name === 'Personal' ? <Home size={12} /> : <Building size={12} />}
                        <span>{project.tenant_name}</span>
                    </div>
                )}
                {project.client_name && (
                    <div className="flex items-center gap-2 text-xs text-indigo-500">
                        <Building size={12} />
                        <span>{project.client_name}</span>
                    </div>
                )}
            </div>

            <div className="mt-6 flex justify-end">
                <span className="text-xs text-indigo-500 font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Open Details <ArrowRight size={12} />
                </span>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
            {/* Header: External View Indicator */}
            <div className="bg-slate-800 text-slate-200 px-8 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={onNavigateHome} className="hover:text-white transition-colors">
                        <ArrowRight className="rotate-180" />
                    </button>
                    <div>
                        <h1 className="text-lg font-medium text-white">Project List</h1>
                        <p className="text-xs text-slate-400">Unified Management View</p>
                    </div>
                </div>
            </div>

            <div className="p-8 max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-light">Projects</h2>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-slate-800 text-white px-4 py-2 rounded-md hover:bg-slate-700 flex items-center gap-2 shadow-lg shadow-slate-200"
                    >
                        <Plus size={18} /> New Project
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-8 border-b border-slate-200">
                    <button
                        onClick={() => setTab('personal')}
                        className={`pb-2 px-4 flex items-center gap-2 transition-colors ${activeTab === 'personal'
                            ? 'border-b-2 border-indigo-600 text-indigo-600 font-medium'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Home size={18} />
                        Personal (基本)
                    </button>
                    <button
                        onClick={() => setTab('company')}
                        className={`pb-2 px-4 flex items-center gap-2 transition-colors ${activeTab === 'company'
                            ? 'border-b-2 border-indigo-600 text-indigo-600 font-medium'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Building size={18} />
                        Company (会社)
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        <p className="text-slate-400 text-sm">Loading projects...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map(project => (
                            <ProjectCard key={project.id} project={project} />
                        ))}
                        {projects.length === 0 && (
                            <div className="col-span-full text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200">
                                <p className="text-slate-400 mb-2">No projects found in {activeTab} view.</p>
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="text-indigo-600 text-sm font-medium hover:underline"
                                >
                                    Create your first project
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ProjectCreateModal
                isOpen={isCreating}
                onClose={() => setIsCreating(false)}
                onCreate={handleCreateProject}
                activeTab={activeTab}
            />
        </div>
    );
};
