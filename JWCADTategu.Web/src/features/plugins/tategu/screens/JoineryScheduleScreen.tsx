import React, { useEffect, useState } from 'react';
import { Door, db } from '../../../../db/db';
import { Project } from '../../../../db/db';
import { generateDoorDxf } from '../../../../utils/DxfGenerator';
import { JoineryHeader } from '../components/JoineryHeader';
import { JoineryList } from '../components/JoineryList';
import { JoineryTabs, JoineryTab } from '../components/JoineryTabs';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { FieldNoteList } from './FieldNoteList';
import { GenericItemModal } from './GenericItemModal';
import { DeliverableList } from '../../manufacturing/DeliverableList';
import { DecisionBoard } from './DecisionBoard';

export const JoineryScheduleScreen: React.FC<{
    project: Project;
    onBack: () => void;
    onOpenDoor: (door: Door) => void;
    onDeleteProject: (id: number) => void;
    onUpdateProject: (p: Project) => void
}> = ({ project, onBack, onOpenDoor, onDeleteProject, onUpdateProject }) => {
    // Mode State
    const [viewMode, setViewMode] = useState<'internal' | 'external'>('internal');
    const [doors, setDoors] = useState<Door[]>([]);

    // Tab State
    const [activeTab, setActiveTab] = useState<JoineryTab>('products');

    // UI Options
    const [showCost, setShowCost] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Generic Item Modal State
    const [isGenericModalOpen, setIsGenericModalOpen] = useState(false);
    const [editingGenericItem, setEditingGenericItem] = useState<Door | null>(null);

    // Data Fetching
    const refreshDoors = async () => {
        if (!project.id) return;
        const items = await db.doors.where('projectId').equals(project.id).toArray();
        setDoors(items);
    };

    useEffect(() => {
        refreshDoors();
    }, [project.id]);

    // View Mode Persistence
    useEffect(() => {
        if (project.viewMode) {
            setViewMode(project.viewMode);
        }
    }, [project.viewMode]);

    // Handlers
    const handleSwitchViewMode = (mode: 'internal' | 'external') => {
        onUpdateProject({ ...project, viewMode: mode });
        db.projects.update(project.id!, { viewMode: mode });
    };

    const handleCreateDoor = async () => {
        const id = await db.doors.add({
            projectId: project.id!,
            name: '新規建具',
            count: 1,
            dimensions: {
                width: 800,
                height: 2000,
                depth: 36,
                // Default Dimensions
                stileWidth: 30,
                topRailWidth: 30,
                bottomRailWidth: 60,
                middleRailWidth: 30,
                middleRailCount: 0,
                tsukaWidth: 30,
                tsukaCount: 0,
                kumikoVertWidth: 6,
                kumikoVertCount: 0,
                kumikoHorizWidth: 6,
                kumikoHorizCount: 0
            },
            category: 'door',
            type: 'flush',
            tag: 'TBD', // Temporary tag
            specs: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            judgmentStatus: 'inbox'
        });
        const newDoor = await db.doors.get(id);
        if (newDoor) {
            onOpenDoor(newDoor);
            // [NEW] Sync to Manufacturing Plugin
            import('../domain/DeliverableIntegrationService').then(({ DeliverableIntegrationService }) => {
                DeliverableIntegrationService.syncDoorToDeliverable(newDoor, project);
            });
        }
        refreshDoors();
    };

    const handleCreateGeneric = () => {
        setEditingGenericItem(null);
        setIsGenericModalOpen(true);
    };

    const handleSaveGeneric = async (item: Partial<Door> | Door) => {
        let savedId: number;
        if (item.id) {
            await db.doors.update(item.id, item as any); // Cast for safety
            savedId = item.id;
        } else {
            // New Item
            const nonDoors = doors.filter(d => d.category && d.category !== 'door');
            const nextIndex = nonDoors.length + 1;
            const tagPrefix = item.category === 'frame' ? 'W' :
                item.category === 'furniture' ? 'K' :
                    item.category === 'hardware' ? 'H' : 'M';

            savedId = await db.doors.add({
                ...(item as Door),
                projectId: project.id!,
                tag: `${tagPrefix}-${nextIndex}`,
                judgmentStatus: 'inbox',
                createdAt: new Date(),
                updatedAt: new Date()
            }) as number;
        }

        // [NEW] Sync Generic Item
        const savedItem = await db.doors.get(savedId);
        if (savedItem) {
            import('../domain/DeliverableIntegrationService').then(({ DeliverableIntegrationService }) => {
                DeliverableIntegrationService.syncDoorToDeliverable(savedItem, project);
            });
        }

        setIsGenericModalOpen(false);
        refreshDoors();
    };

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm('本当に削除しますか？')) {
            await db.doors.delete(id);
            refreshDoors();
        }
    };

    const handleDuplicate = async (e: React.MouseEvent, door: Door) => {
        e.stopPropagation();
        const { id, deliverableId, ...rest } = door; // Exclude deliverableId
        const newId = await db.doors.add({ ...rest, name: `${door.name} (Copy)`, createdAt: new Date() });

        const newDoor = await db.doors.get(newId);
        if (newDoor) {
            import('../domain/DeliverableIntegrationService').then(({ DeliverableIntegrationService }) => {
                DeliverableIntegrationService.syncDoorToDeliverable(newDoor, project);
            });
        }
        refreshDoors();
    };

    const handleGenericEdit = (door: Door) => {
        setEditingGenericItem(door);
        setIsGenericModalOpen(true);
    };

    const handleSaveSettings = (updatedProject: Project) => {
        onUpdateProject(updatedProject);
        setIsSettingsOpen(false);
    };

    const handleExportDxf = async () => {
        const doorsToExport = doors.filter(d => d.category === 'door' || !d.category);
        for (const door of doorsToExport) {
            generateDoorDxf([door], project.dxfLayerConfig);
        }
        alert('DXFの一括出力ロジックは実装中です。個別の建具画面から出力してください。');
    };

    // Render
    if (viewMode === 'internal') {
        return (
            <div className="h-full flex flex-col">
                <JoineryHeader
                    project={project}
                    onBack={onBack}
                    onUpdateProject={onUpdateProject}
                    onDeleteProject={onDeleteProject}
                    onExportDxf={handleExportDxf}
                    onSwitchInternal={() => { /* Already internal */ }}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                />
                <div className="flex-1 overflow-hidden">
                    <DecisionBoard
                        projectId={project.id!}
                        onSwitchToExternal={() => handleSwitchViewMode('external')}
                    />
                </div>
                {isSettingsOpen && (
                    <ProjectSettingsModal
                        project={project}
                        isOpen={isSettingsOpen}
                        onClose={() => setIsSettingsOpen(false)}
                        onSave={handleSaveSettings}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="p-8 h-full bg-slate-950 text-slate-200 overflow-auto flex flex-col">
            <JoineryHeader
                project={project}
                onBack={onBack}
                onUpdateProject={onUpdateProject}
                onDeleteProject={onDeleteProject}
                onExportDxf={handleExportDxf}
                onSwitchInternal={() => handleSwitchViewMode('internal')}
                onOpenSettings={() => setIsSettingsOpen(true)}
            />

            <JoineryTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                showCost={showCost}
                onShowCostChange={setShowCost}
            />

            {/* Content per Tab */}
            {activeTab === 'products' ? (
                <JoineryList
                    project={project}
                    doors={doors}
                    searchQuery={searchQuery}
                    showCost={showCost}
                    onOpenDoor={onOpenDoor}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                    onGenericEdit={handleGenericEdit}
                    onCreateDoor={handleCreateDoor}
                    onCreateGeneric={handleCreateGeneric}
                />
            ) : activeTab === 'deliverables' ? (
                <div className="flex-1 overflow-auto pb-4 bg-slate-900/50 -mx-8 px-8 py-4 rounded-lg">
                    {project.id && (
                        <DeliverableList
                            projectId={String(project.id)}
                            projectTitle={project.name}
                            onDeliverableChange={refreshDoors}
                        />
                    )}
                </div>
            ) : (
                <FieldNoteList projectId={project.id!} />
            )}

            {/* Modals */}
            {isSettingsOpen && (
                <ProjectSettingsModal
                    project={project}
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    onSave={handleSaveSettings}
                />
            )}

            {isGenericModalOpen && project.id && (
                <GenericItemModal
                    isOpen={isGenericModalOpen}
                    onClose={() => setIsGenericModalOpen(false)}
                    item={editingGenericItem}
                    projectId={project.id}
                    // @ts-ignore: Door vs Partial<Door> type mismatch - safe to ignore here or fix in GenericItemModal
                    onSave={handleSaveGeneric}
                />
            )}
        </div>
    );
};
