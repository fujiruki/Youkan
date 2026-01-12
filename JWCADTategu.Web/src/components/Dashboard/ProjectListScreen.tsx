import React, { useState, useEffect } from 'react';
import { db, Project } from '../../db/db';
import { Plus, ArrowRight, Table, FileText, Trash2, Edit2 } from 'lucide-react';

interface ProjectListScreenProps {
    onSelectProject: (projectId: number) => void;
    onNavigateHome: () => void;
}

export const ProjectListScreen: React.FC<ProjectListScreenProps> = ({
    onSelectProject,
    onNavigateHome
}) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        const data = await db.projects.toArray();
        setProjects(data);
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;
        await db.projects.add({
            name: newProjectName,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        setNewProjectName('');
        setIsCreating(false);
        loadProjects();
    };

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
                        <p className="text-xs text-slate-400">External Management View</p>
                    </div>
                </div>
                <div>
                    <div className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs rounded border border-amber-500/30">
                        ⚠️ 説明用モード：判断には使用しないでください
                    </div>
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

                {isCreating && (
                    <div className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-slate-200 animate-in slide-in-from-top-2">
                        <label className="block text-sm font-medium mb-2">Project Name</label>
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                className="flex-1 border border-slate-300 rounded px-3 py-2"
                                placeholder="e.g. K邸新築工事"
                                autoFocus
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
                                {/* Date hidden by user request */}
                                <div className="flex items-center gap-2">
                                    <FileText size={14} />
                                    <span>Project</span>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end">
                                <span className="text-xs text-indigo-500 font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                    Open Details <ArrowRight size={12} />
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
