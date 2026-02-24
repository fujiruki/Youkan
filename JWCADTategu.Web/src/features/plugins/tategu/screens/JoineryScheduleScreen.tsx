import React, { useState } from 'react';
import { Door } from '../../../../db/db';
import { JoineryHeader } from '../components/JoineryHeader';
import { JoineryList } from '../components/JoineryList';
import { JoineryTabs } from '../components/JoineryTabs';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { GenericItemModal } from './GenericItemModal';
import { DeliverableList } from '../../manufacturing/DeliverableList';
import { DecisionBoard } from './DecisionBoard';
import { useJoineryViewModel } from '../hooks/useJoineryViewModel';
import { DocumentList } from '../components/documents/DocumentList';
import { DocumentEditor } from '../components/documents/DocumentEditor';
import { Document } from '../domain/ManufacturingTypes';

import { Project as LocalProject } from '../../../../features/core/youkan/types';

type JoineryScheduleScreenProps = {
    project: LocalProject;
    onBack: () => void;
    onOpenDoor: (door: Door) => void;
    onDeleteProject: (id: number) => void;
    onArchiveProject: (id: number) => void;
    onUpdateProject: (p: any) => void
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

    // Document Editor State
    const [isDocEditorOpen, setIsDocEditorOpen] = useState(false);
    const [editingDocument, setEditingDocument] = useState<Document | null>(null);
    const [docEditorType, _setDocEditorType] = useState<'estimate' | 'sales'>('estimate');

    const handleSelectDocument = (doc: Document) => {
        setEditingDocument(doc);
        setIsDocEditorOpen(true);
    };

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
                                projectTitle={project.title || project.name}
                            />
                        ) : activeTab === 'documents' ? (
                            <div className="h-full p-4">
                                <DocumentList
                                    projectId={String(project.id)}
                                    onSelectDocument={handleSelectDocument}
                                />
                            </div>
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
                    category: 'other',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    judgmentStatus: 'inbox' as any
                }}
                projectId={project.id!}
            />

            {/* Document Editor (Full Screen) */}
            <DocumentEditor
                isOpen={isDocEditorOpen}
                onClose={() => { setIsDocEditorOpen(false); setEditingDocument(null); }}
                projectId={String(project.id)}
                initialDocument={editingDocument}
                initialType={docEditorType}
            />
        </div>
    );
};
