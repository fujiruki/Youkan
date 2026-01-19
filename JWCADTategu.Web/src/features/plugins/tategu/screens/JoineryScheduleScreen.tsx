import React from 'react';
import { Door } from '../../../../db/db';
import { Project } from '../../../../db/db';
import { JoineryHeader } from '../components/JoineryHeader';
import { JoineryList } from '../components/JoineryList';
import { JoineryTabs } from '../components/JoineryTabs';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { GenericItemModal } from './GenericItemModal';
import { DeliverableList } from '../../manufacturing/DeliverableList';
import { DecisionBoard } from './DecisionBoard';
import { useJoineryViewModel } from '../hooks/useJoineryViewModel';

type JoineryScheduleScreenProps = {
    project: Project;
    onBack: () => void;
    onOpenDoor: (door: Door) => void;
    onDeleteProject: (id: number) => void;
    onArchiveProject: (id: number) => void;
    onUpdateProject: (p: Project) => void
}

export const JoineryScheduleScreen: React.FC<JoineryScheduleScreenProps> = ({
    project,
    onBack,
    onOpenDoor,
    onDeleteProject,
    onArchiveProject,
    onUpdateProject
}) => {

    const {
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
        setActiveTab,
        setShowCost,
        setSearchQuery,
        setIsSettingsOpen,
        setIsGenericModalOpen,

        // Actions
        handleSwitchViewMode,
        handleCreateDoor,
        handleCreateGeneric,
        handleGenericEdit,
        handleSaveGeneric,
        handleDelete,
        handleDuplicate,
        handleSaveSettings,
        handleExportDxf
    } = useJoineryViewModel(project, onUpdateProject, onOpenDoor);

    // Render
    if (viewMode === 'internal') {
        return (
            <div className="h-full flex flex-col">
                <JoineryHeader
                    project={project}
                    onBack={onBack}
                    onUpdateProject={onUpdateProject}
                    onExportDxf={handleExportDxf}
                    onSwitchInternal={() => { /* Already internal */ }}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    theme="dark"
                />
                <div className="flex-1 overflow-hidden">
                    <DecisionBoard
                        projectId={project.id!}
                        onSwitchToExternal={() => handleSwitchViewMode('external')}
                        onOpenDoor={onOpenDoor}
                    />
                </div>

                {isSettingsOpen && (
                    <ProjectSettingsModal
                        project={project}
                        isOpen={isSettingsOpen}
                        onClose={() => setIsSettingsOpen(false)}
                        onSave={handleSaveSettings}
                        onDeleteProject={onDeleteProject}
                        onArchiveProject={onArchiveProject}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50 relative">
            <JoineryHeader
                project={project}
                onBack={onBack}
                onUpdateProject={onUpdateProject}
                onExportDxf={handleExportDxf}
                onSwitchInternal={() => handleSwitchViewMode('internal')}
                onOpenSettings={() => setIsSettingsOpen(true)}
                theme="light"
            />

            <div className="flex-1 flex overflow-hidden">
                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    <JoineryTabs
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        showCost={showCost}
                        onShowCostChange={setShowCost}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                    />

                    <div className="flex-1 overflow-hidden relative">
                        {activeTab === 'deliverables' ? (
                            <DeliverableList
                                projectId={String(project.id)}
                                projectTitle={project.name}
                            />
                        ) : (
                            <JoineryList
                                doors={doors}
                                activeTab={activeTab}
                                searchQuery={searchQuery}
                                showCost={showCost}
                                onOpenDoor={onOpenDoor}
                                onGenericEdit={handleGenericEdit}
                                onDelete={handleDelete}
                                onDuplicate={handleDuplicate}
                                onCreateDoor={handleCreateDoor}
                                onCreateGeneric={handleCreateGeneric}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isSettingsOpen && (
                <ProjectSettingsModal
                    project={project}
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    onSave={handleSaveSettings}
                    onDeleteProject={onDeleteProject}
                    onArchiveProject={onArchiveProject}
                />
            )}

            <GenericItemModal
                isOpen={isGenericModalOpen}
                onClose={() => setIsGenericModalOpen(false)}
                onSave={handleSaveGeneric}
                item={editingGenericItem || {
                    name: '新規アイテム',
                    count: 1,
                    category: 'other'
                }}
                projectId={project.id!}
            />
        </div>
    );
};
