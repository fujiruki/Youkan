import React, { useState, useEffect } from 'react';
// import { db, Project } from '../../../../db/db';
import { Plus, ArrowRight, FileText, Edit2, Building, Home } from 'lucide-react';
// import { JBWOSRepository } from '../../../core/jbwos/repositories/JBWOSRepository';
import { ApiClient } from '../../../../api/client';

interface ProjectListScreenProps {
    onSelectProject: (projectId: number) => void;
    onNavigateHome: () => void;
}

export const ProjectListScreen: React.FC<ProjectListScreenProps> = ({
    onSelectProject,
    onNavigateHome
}) => {
    const [activeTab, setActiveTab] = useState<'personal' | 'company'>('personal');
    const [projects, setProjects] = useState<any[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    useEffect(() => {
        loadProjects();
    }, [activeTab]);

    const loadProjects = async () => {
        try {
            setProjects([]); // Clear before load
            const data = await ApiClient.getProjects({ scope: activeTab });
            setProjects(data);
        } catch (e) {
            console.error('Failed to load projects from API:', e);
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;

        try {
            await ApiClient.createItem({
                title: newProjectName,
                projectType: 'general',
                status: 'inbox',
                // Explicitly send tenant_id if creating in Company tab? 
                // Currently API handles tenant_id based on User Context.
                // If user is logged in as Company, scope=company -> API should Create in Company?
                // ProjectController create() logic uses currentTenantId.
                // So if user's token is for Personal Tenant, it creates Personal.
                // If token is Company, it creates Company.
                // NOTE: View Filtering doesn't change Create Context unless we switch Token Context.
                // For Phase 10, let's assume Context is fixed per session (Token).
            });

            setNewProjectName('');
            setIsCreating(false);
            loadProjects();
        } catch (error) {
            console.error('Failed to create project:', error);
            window.alert('Failed to create project: ' + error);
        }
    };

    const ProjectCard = ({ project }: { project: any }) => (
        <div
            key={project.id}
            className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            onClick={() => onSelectProject(project.id!)}
        >
            <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-slate-700 group-hover:text-indigo-600 transition-colors">
                    {project.name}
                </h3>
                <button className="text-slate-300 hover:text-slate-500">
                    <Edit2 size={16} />
                </button>
            </div>

            <div className="text-sm text-slate-500 space-y-2">
                <div className="flex items-center gap-2">
                    <FileText size={14} />
                    <span>Project ({project.type || 'general'})</span>
                </div>
                {project.tenantName && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        {project.tenantName === 'Personal' ? <Home size={12} /> : <Building size={12} />}
                        <span>{project.tenantName}</span>
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
                <div>
                    {/* Tab Switcher in Header or Below? Let's put it below title in main area or here */}
                </div>
            </div>

            <div className="p-8 max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-light">Projects</h2>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-slate-800 text-white px-4 py-2 rounded-md hover:bg-slate-700 flex items-center gap-2"
                    >
                        <Plus size={18} /> New Project
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-8 border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('personal')}
                        className={`pb-2 px-4 flex items-center gap-2 transition-colors ${activeTab === 'personal'
                                ? 'border-b-2 border-indigo-600 text-indigo-600 font-medium'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Home size={18} />
                        Personal (基本)
                    </button>
                    <button
                        onClick={() => setActiveTab('company')}
                        className={`pb-2 px-4 flex items-center gap-2 transition-colors ${activeTab === 'company'
                                ? 'border-b-2 border-indigo-600 text-indigo-600 font-medium'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Building size={18} />
                        Company (会社)
                    </button>
                </div>

                {isCreating && (
                    <div className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-slate-200 animate-in slide-in-from-top-2">
                        <label className="block text-sm font-medium mb-2">Project Name ({activeTab === 'personal' ? 'Personal' : 'Company'})</label>
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                className="flex-1 border border-slate-300 rounded px-3 py-2"
                                placeholder="e.g. K邸新築工事 / キッチン棚"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreateProject();
                                }}
                            />
                            <button onClick={handleCreateProject} className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700">
                                Create
                            </button>
                            <button onClick={() => setIsCreating(false)} className="text-slate-500 px-4 py-2 hover:bg-slate-100 rounded">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => (
                        <ProjectCard key={project.id} project={project} />
                    ))}
                    {projects.length === 0 && (
                        <div className="col-span-full text-center py-12 text-slate-400">
                            No projects found in {activeTab} view.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
