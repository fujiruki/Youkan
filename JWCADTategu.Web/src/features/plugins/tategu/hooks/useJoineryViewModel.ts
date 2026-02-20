import { useState, useEffect, useCallback } from 'react';
import { Door, db, Project } from '../../../../db/db';
import { JoineryTab } from '../components/JoineryTabs';
import { generateDoorDxf } from '../../../../utils/DxfGenerator';

export const useJoineryViewModel = (
    project: Project,
    onUpdateProject: (p: Project) => void,
    onOpenDoor: (door: Door) => void
) => {
    // Mode State
    const [viewMode, setViewMode] = useState<'internal' | 'external' | 'mixed'>('internal');
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
    const refreshDoors = useCallback(async () => {
        if (!project.id) return;
        const items = await db.doors.where('projectId').equals(project.id).toArray();
        setDoors(items);
    }, [project.id]);

    useEffect(() => {
        refreshDoors();
    }, [refreshDoors]);

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
        setViewMode(mode);
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
            // Slight delay to ensure UI stability before transition
            setTimeout(() => onOpenDoor(newDoor), 50);

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

    const handleGenericEdit = (door: Door) => {
        setEditingGenericItem(door);
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
        const newId = await db.doors.add({ ...rest, name: `${door.name} (Copy)`, createdAt: new Date(), updatedAt: new Date() });

        const newDoor = await db.doors.get(newId);
        if (newDoor) {
            import('../domain/DeliverableIntegrationService').then(({ DeliverableIntegrationService }) => {
                DeliverableIntegrationService.syncDoorToDeliverable(newDoor, project);
            });
        }
        refreshDoors();
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

    return {
        // State
        viewMode,
        doors,
        activeTab,
        showCost,
        searchQuery,
        isSettingsOpen,
        isGenericModalOpen,
        editingGenericItem,

        // Setters
        setViewMode,
        setActiveTab,
        setShowCost,
        setSearchQuery,
        setIsSettingsOpen,
        setIsGenericModalOpen,

        // Actions
        refreshDoors,
        handleSwitchViewMode,
        handleCreateDoor,
        handleCreateGeneric,
        handleGenericEdit,
        handleSaveGeneric,
        handleDelete,
        handleDuplicate,
        handleSaveSettings,
        handleExportDxf
    };
};
