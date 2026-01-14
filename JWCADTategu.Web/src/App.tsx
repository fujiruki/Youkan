import { useState, useEffect } from 'react';
// import { DashboardScreen } from './components/Dashboard/DashboardScreen'; // Deprecated
// import { GlobalDecisionBoard } from './components/Dashboard/GlobalDecisionBoard';
import { ProjectListScreen } from './components/Dashboard/ProjectListScreen';
import { JoineryScheduleScreen } from './components/Dashboard/JoineryScheduleScreen';
import { EditorScreen } from './components/Editor/EditorScreen';
import { Project, Door, db } from './db/db';
import { DebugBanner } from './components/Debug/DebugBanner';
import { CatalogScreen } from './components/Catalog/CatalogScreen';

import { JbwosBoard } from './features/jbwos/components/GlobalBoard/GlobalBoard'; // [NEW] MVP Board
import { TodayScreen } from './features/jbwos/components/Today/TodayScreen'; // [NEW] Today Screen
import { HistoryScreen } from './features/jbwos/components/History/HistoryScreen'; // [NEW] History Screen

import { UndoProvider } from './features/jbwos/contexts/UndoContext';
import { UndoToast } from './features/jbwos/components/UI/UndoToast';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ToastContainer } from './components/Toast/ToastContainer';
import { ApiClient } from './api/client';
import { JBWOSHeader } from './components/Layout/JBWOSHeader';

type ViewState = 'dashboard' | 'projectList' | 'schedule' | 'editor' | 'catalog' | 'jbwos' | 'today' | 'history';

function App() {
    // Default is now JBWOS MVP Board for verification
    const [currentView, setCurrentView] = useState<ViewState>('jbwos');
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [activeDoor, setActiveDoor] = useState<Door | null>(null);

    // --- Navigation Handlers ---

    // 1. To Project List (External View)
    const handleNavigateToProjects = () => {
        setCurrentView('projectList');
        setActiveProject(null);
    };

    // 2. To Specific Project (Schedule View)
    const handleOpenProject = async (projectId: number) => {
        try {
            console.log('[App] Opening Project ID:', projectId);
            const p = await db.projects.get(projectId);
            if (p) {
                console.log('[App] Project found:', p);
                setActiveProject(p);
                setCurrentView('schedule');
            } else {
                console.error('[App] Project not found for ID:', projectId);
                alert('Project not found');
            }
        } catch (error) {
            console.error('[App] Failed to open project:', error);
            alert('Failed to open project');
        }
    };

    // 3. To Editor (Directly from Global Board or Schedule)
    const handleOpenDoor = (door: Door) => {
        console.log('[App] Opening Door:', door.id);
        setActiveDoor(door);
        setCurrentView('editor');
    };

    // 4. Back Home (Global Decision Board -> JBWOS)
    const handleBackToDashboard = () => {
        console.log('[App] Back to Global Board (JBWOS)');
        setCurrentView('jbwos');
        setActiveProject(null);
    };

    // 5. Back to Project List
    const handleBackToProjectList = () => {
        setCurrentView('projectList');
        setActiveProject(null);
    };

    const handleBackToSchedule = () => {
        console.log('[App] Back to Schedule');
        setCurrentView('schedule');
        setActiveDoor(null);
    };


    // [NEW] Delete Project Handler
    const handleDeleteProject = async (projectId: number) => {
        try {
            await db.projects.delete(projectId);
            // Also delete related doors? Ideally yes, but Dexie doesn't cascade automatically.
            // For MVP, leave orphans or clean up manually.
            // Let's do a simple cleanup.
            const doors = await db.doors.where('projectId').equals(projectId).toArray();
            const doorIds = doors.map(d => d.id!);
            await db.doors.bulkDelete(doorIds);

            console.log(`[App] Project ${projectId} deleted.`);
            setActiveProject(null);
            setCurrentView('projectList');
        } catch (error) {
            console.error('[App] Failed to delete project:', error);
            alert('削除に失敗しました。');
        }
    };

    // [NEW] Global Shortcuts
    // Ctrl+J -> Jump to JBWOS (Dashboard)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
                e.preventDefault();
                console.log('[Shortcut] Ctrl+J: Switching to JBWOS');
                handleBackToDashboard();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <ToastProvider>
            <AppContent
                currentView={currentView}
                setCurrentView={setCurrentView}
                activeProject={activeProject}
                activeDoor={activeDoor}
                handleNavigateToProjects={handleNavigateToProjects}
                handleOpenProject={handleOpenProject}
                handleOpenDoor={handleOpenDoor}
                handleBackToDashboard={handleBackToDashboard}
                handleBackToProjectList={handleBackToProjectList}
                handleBackToSchedule={handleBackToSchedule}
                handleDeleteProject={handleDeleteProject}
                setActiveProject={setActiveProject}
            />
        </ToastProvider>
    );
}

// Separate component to access Toast context
const AppContent: React.FC<{
    currentView: ViewState;
    setCurrentView: (view: ViewState) => void;
    activeProject: Project | null;
    activeDoor: Door | null;
    handleNavigateToProjects: () => void;
    handleOpenProject: (id: number) => Promise<void>;
    handleOpenDoor: (door: Door) => void;
    handleBackToDashboard: () => void;
    handleBackToProjectList: () => void;
    handleBackToSchedule: () => void;
    handleDeleteProject: (id: number) => Promise<void>;
    setActiveProject: (p: Project | null) => void;
}> = ({
    currentView,
    setCurrentView,
    activeProject,
    activeDoor,
    handleNavigateToProjects,
    handleOpenProject,
    handleOpenDoor,
    handleBackToDashboard,
    handleBackToProjectList,
    handleBackToSchedule,
    handleDeleteProject,
    setActiveProject
}) => {
        const { showToast, toasts, dismissToast } = useToast();

        // Setup API error handler
        useEffect(() => {
            ApiClient.setErrorHandler((error, method, path) => {
                showToast({
                    type: 'error',
                    title: 'API通信エラー',
                    message: `${method} ${path}: ${error.message}`,
                    duration: 7000
                });
            });
        }, [showToast]);

        return (
            <>
                <UndoProvider>
                    <div className="h-screen w-screen bg-slate-950 text-slate-200 font-sans flex flex-col">

                        <DebugBanner />
                        {/* New JBWOS Header */}
                        {(currentView === 'jbwos' || currentView === 'today' || currentView === 'history') && (
                            <JBWOSHeader
                                currentView={currentView as 'jbwos' | 'today' | 'history'}
                                onNavigateToToday={() => setCurrentView('today')}
                                onNavigateToHistory={() => setCurrentView('history')}
                                onNavigateToProjects={handleNavigateToProjects}
                            />
                        )}

                        <div className={`flex-1 overflow-hidden relative ${currentView === 'dashboard' ? 'bg-[#F8F9FA]' : ''}`}>

                            {/* 1. Global Decision Board (Replaced by JBWOS) */}
                            {/* 
                      Old 'dashboard' view is deprecated. 
                      We use 'jbwos' as the main dashboard now.
                    */}

                            {/* 0. JBWOS (MVP) - MAIN DASHBOARD */}
                            {(currentView === 'jbwos' || currentView === 'dashboard') && (
                                <div className="h-full w-full bg-slate-100 dark:bg-slate-950">
                                    <JbwosBoard onClose={handleNavigateToProjects} />
                                </div>
                            )}

                            {/* 2. Project List (External View) */}
                            {currentView === 'projectList' && (
                                <ProjectListScreen
                                    onSelectProject={handleOpenProject}
                                    onNavigateHome={handleBackToDashboard}
                                />
                            )}

                            {/* 3. Schedule (External Project Detail) */}
                            {currentView === 'schedule' && activeProject && (
                                <JoineryScheduleScreen
                                    project={activeProject}
                                    // If coming from ProjectList, "Back" usually means back to list.
                                    // But historically it meant dashboard. Let's point to ProjectList now.
                                    onBack={handleBackToProjectList}
                                    onOpenDoor={handleOpenDoor}
                                    onDeleteProject={() => handleDeleteProject(activeProject.id!)} // [FIX] Connect handler
                                    onUpdateProject={setActiveProject}
                                />
                            )}

                            {/* 4. Editor */}
                            {currentView === 'editor' && activeDoor && (
                                <EditorScreen
                                    doorId={activeDoor.id!}
                                    onBack={handleBackToSchedule} // Or Back to Global if that's where we came from?
                                // Ideally we remember previous view. For now Schedule is safe, 
                                // but if we came from Global, we might want to go back there.
                                // Improvement: Add `returnView` state.
                                />
                            )}

                            {/* 5. Catalog */}
                            {currentView === 'catalog' && (
                                <CatalogScreen
                                    onBack={handleBackToDashboard}
                                />
                            )}

                            {/* 6. Today Screen (Execution) */}
                            {currentView === 'today' && (
                                <TodayScreen onBack={() => setCurrentView('jbwos')} />
                            )}

                            {/* 7. History Screen */}
                            {currentView === 'history' && (
                                <HistoryScreen onBack={() => setCurrentView('jbwos')} />
                            )}
                        </div>

                        {/* Global Undo Toast */}
                        <UndoToast />
                    </div>
                </UndoProvider>
                <ToastContainer toasts={toasts} onDismiss={dismissToast} />
            </>
        );
    };

export default App;
