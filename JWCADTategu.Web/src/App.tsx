import { useState, useEffect } from 'react';
// import { DashboardScreen } from './components/Dashboard/DashboardScreen'; // Deprecated
// import { GlobalDecisionBoard } from './components/Dashboard/GlobalDecisionBoard';
import { ProjectListScreen } from './features/plugins/tategu/screens/ProjectListScreen';
import { JoineryScheduleScreen } from './features/plugins/tategu/screens/JoineryScheduleScreen';
import { EditorScreen } from './features/plugins/tategu/editor/EditorScreen';
import { Project, Door, db } from './db/db';
import { DebugBanner } from './components/Debug/DebugBanner';
import { CatalogScreen } from './features/plugins/tategu/catalog/CatalogScreen';

import { JbwosBoard } from './features/core/jbwos/components/GlobalBoard/GlobalBoard'; // [NEW] MVP Board
import { TodayScreen } from './features/core/jbwos/components/Today/TodayScreen'; // [NEW] Today Screen
import { FutureBoard } from './features/core/planning/FutureBoard'; // [NEW]
import { HistoryScreen } from './features/core/jbwos/components/History/HistoryScreen'; // [NEW] History Screen
import { ProjectRegistryScreen } from './features/core/jbwos/screens/ProjectRegistryScreen'; // [NEW] Project Registry
import { CustomerList } from './features/plugins/customer'; // [NEW] Customer Plugin

import { UndoProvider } from './features/core/jbwos/contexts/UndoContext';
import { UndoToast } from './features/core/jbwos/components/UI/UndoToast';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ToastContainer } from './components/Toast/ToastContainer';
import { ApiClient } from './api/client';
import { JBWOSHeader } from './components/Layout/JBWOSHeader';
import { SettingsScreen } from './pages/SettingsScreen'; // [NEW]
import { CompanySettingsScreen } from './features/core/projects/screens/CompanySettingsScreen'; // [NEW]

import { ManualScreen } from './features/core/manual/ManualScreen'; // [NEW] Manuals
import { UserManagementScreen } from './features/admin/screens/UserManagementScreen'; // [NEW] User Management

// Auth Imports
// Auth Imports
import { AuthProvider, useAuth } from './features/core/auth/providers/AuthProvider';
import { LoginScreen } from './features/core/auth/screens/LoginScreen';
import { RegistrationScreen } from './pages/RegistrationScreen';
import { LogoutScreen } from './features/core/auth/screens/LogoutScreen';

import { VolumeCalendarScreen } from './features/core/calendar/screens/VolumeCalendarScreen'; // [NEW]

type ViewState = 'dashboard' | 'projectList' | 'projects' | 'schedule' | 'editor' | 'catalog' | 'jbwos' | 'today' | 'planning' | 'history' | 'settings' | 'customers' | 'manual' | 'userlist' | 'companySettings' | 'calendar';

function App() {
    // Default is now JBWOS MVP Board for verification
    const [currentView, setCurrentView] = useState<ViewState>('jbwos');
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [activeDoor, setActiveDoor] = useState<Door | null>(null);

    // [NEW] URL Routing State
    const [initialDashboardLayout, setInitialDashboardLayout] = useState<'standard' | 'panorama'>('standard');

    // [NEW] URL Router Effect (Run Once)
    useEffect(() => {
        const path = window.location.pathname.toLowerCase();

        // JBWOS Routing
        // /JBWOS/Panorama -> jbwos + panorama
        // /JBWOS/Focus    -> jbwos + standard

        if (path.includes('/jbwos/panorama')) {
            console.log('[Router] Detected Panorama URL');
            setCurrentView('jbwos');
            setInitialDashboardLayout('panorama');
        } else if (path.includes('/jbwos/focus')) {
            console.log('[Router] Detected Focus URL');
            setCurrentView('jbwos');
            setInitialDashboardLayout('standard');
        } else if (path.includes('/userlist')) {
            console.log('[Router] Detected UserList URL');
            setCurrentView('userlist');
        }
        // Else default to what's in useState or other logic (e.g. Deep linking below)
    }, []);

    // --- Navigation Handlers ---

    // 1. To Project List (External View)
    const handleNavigateToProjects = () => {
        setCurrentView('projects'); // Switched to New Project Registry
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
                alert('プロジェクトが見つかりません');
            }
        } catch (error) {
            console.error('[App] Failed to open project:', error);
            alert('プロジェクトを開けませんでした');
        }
    };

    // 2.5. To Cloud Project (From ProjectRegistryScreen)
    const handleOpenCloudProject = (projectId: string) => {
        console.log('[App] Opening Cloud Project:', projectId);
        // Create a minimal Project object for JoineryScheduleScreen
        // Use the cloud ID as both:
        // - id: Generate a numeric ID from the string for local compatibility
        // - name: Store in a way we can retrieve (prefix with cloudId for now)
        const numericId = parseInt(projectId.replace(/[^0-9]/g, '').slice(-9) || '1', 10) || Date.now();
        const cloudProject: Project = {
            id: numericId,
            name: `[CLOUD:${projectId}]`, // Marker for cloud project
            client: '',
            updatedAt: new Date(),
            createdAt: new Date()
        };
        setActiveProject(cloudProject);
        setCurrentView('schedule');
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

    // [NEW] Archive Project Handler
    const handleArchiveProject = async (projectId: number) => {
        console.log('[App] handleArchiveProject called for ID:', projectId);
        try {
            await db.projects.update(projectId, { isArchived: true });
            console.log(`[App] Project ${projectId} archived (DB update success).`);

            // Allow time for DB to persist
            await new Promise(resolve => setTimeout(resolve, 100));

            setActiveProject(null);
            setCurrentView('projectList');
            alert('プロジェクトをアーカイブしました。');
        } catch (error) {
            console.error('[App] Failed to archive project:', error);
            alert('アーカイブに失敗しました。');
        }
    };

    // [NEW] Global Keyboard Shortcuts
    // [NEW] Global Keyboard Shortcuts & Deep Linking
    useEffect(() => {
        // Keyboard Shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+G: Navigate to GDB (JBWOS Board)
            if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
                e.preventDefault();
                console.log('[Shortcut] Ctrl+G: Switching to JBWOS');
                handleBackToDashboard();
            }
            // Ctrl+J: Also navigate to JBWOS (legacy support)
            if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
                e.preventDefault();
                console.log('[Shortcut] Ctrl+J: Switching to JBWOS');
                handleBackToDashboard();
            }
            // Ctrl+T: Navigate to Today
            if ((e.ctrlKey || e.metaKey) && e.key === 't') {
                e.preventDefault();
                console.log('[Shortcut] Ctrl+T: Switching to Today');
                setCurrentView('today');
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        // Deep Linking Check
        const params = new URLSearchParams(window.location.search);
        const doorIdParam = params.get('doorId');

        if (doorIdParam) {
            const doorId = parseInt(doorIdParam, 10);
            if (!isNaN(doorId)) {
                console.log('[App] Deep linking to door:', doorId);
                // Async load inside effect
                const load = async () => {
                    try {
                        const door = await db.doors.get(doorId);
                        if (door) {
                            setActiveDoor(door);

                            // Load associated project to enable valid "Back" navigation
                            if (door.projectId) {
                                const project = await db.projects.get(door.projectId);
                                if (project) {
                                    setActiveProject(project);
                                }
                            }

                            setCurrentView('editor');
                        } else {
                            console.warn('[App] Deep linked door not found:', doorId);
                            // Fallback to JBWOS (default)
                        }
                    } catch (e) {
                        console.error('[App] Failed to load deep link data:', e);
                    }
                };
                load();
            }
        }

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <ToastProvider>
            <AuthProvider>
                <AuthGuard bypass={currentView === 'userlist'}>
                    <AppContent
                        currentView={currentView}
                        setCurrentView={setCurrentView}
                        activeProject={activeProject}
                        activeDoor={activeDoor}
                        handleNavigateToProjects={handleNavigateToProjects}
                        handleOpenProject={handleOpenProject}
                        handleOpenCloudProject={handleOpenCloudProject}
                        handleOpenDoor={handleOpenDoor}
                        handleBackToDashboard={handleBackToDashboard}
                        handleBackToProjectList={handleBackToProjectList}
                        handleBackToSchedule={handleBackToSchedule}
                        handleDeleteProject={handleDeleteProject}
                        handleArchiveProject={handleArchiveProject}
                        setActiveProject={setActiveProject}
                        initialDashboardLayout={initialDashboardLayout} // [NEW]
                    />
                </AuthGuard>
            </AuthProvider>
        </ToastProvider>
    );
}

// Helper to guard content
const AuthGuard: React.FC<{ children: React.ReactNode; bypass?: boolean }> = ({ children, bypass }) => {
    const { isAuthenticated, isLoading } = useAuth();

    // Debug or Public view bypass
    if (bypass) {
        return <>{children}</>;
    }


    if (isLoading) {
        return <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white">Loading...</div>;
    }

    if (!isAuthenticated) {
        // [FIX] Support subdirectories by checking endsWith
        if (window.location.pathname.endsWith('/register')) {
            return <RegistrationScreen />;
        }
        if (window.location.pathname.endsWith('/logout')) {
            return <LogoutScreen />;
        }
        return <LoginScreen />;
    }

    if (window.location.pathname.endsWith('/logout')) {
        return <LogoutScreen />;
    }

    return <>{children}</>;
};

// Separate component to access Toast context
const AppContent: React.FC<{
    currentView: ViewState;
    setCurrentView: (view: ViewState) => void;
    activeProject: Project | null;
    activeDoor: Door | null;
    handleNavigateToProjects: () => void;
    handleOpenProject: (id: number) => Promise<void>;
    handleOpenCloudProject: (id: string) => void;
    handleOpenDoor: (door: Door) => void;
    handleBackToDashboard: () => void;
    handleBackToProjectList: () => void;
    handleBackToSchedule: () => void;
    handleDeleteProject: (id: number) => Promise<void>;
    handleArchiveProject: (id: number) => Promise<void>;
    setActiveProject: (p: Project | null) => void;
    initialDashboardLayout: 'standard' | 'panorama'; // [NEW]
}> = ({
    currentView,
    setCurrentView,
    activeProject,
    activeDoor,
    handleNavigateToProjects,
    handleOpenProject,
    handleOpenCloudProject,
    handleOpenDoor,
    handleBackToDashboard,
    handleBackToProjectList,
    handleBackToSchedule,
    handleDeleteProject,
    handleArchiveProject,
    setActiveProject,
    initialDashboardLayout // [NEW]
}) => {
        const { showToast, toasts, dismissToast } = useToast();
        const { user, tenant } = useAuth(); // [NEW] Fetch Auth Info

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
                    <div className="h-screen w-full bg-slate-950 text-slate-200 font-sans flex flex-col">

                        <DebugBanner />
                        {/* New JBWOS Header */}
                        {/* Immersive Mode for Today Screen: Hide Global Header */}
                        {(currentView === 'jbwos' || currentView === 'planning' || currentView === 'history' || currentView === 'customers') && (
                            <JBWOSHeader
                                currentView={currentView as 'jbwos' | 'today' | 'history' | 'settings' | 'customers'}
                                onNavigateToToday={() => setCurrentView('today')}
                                onNavigateToHistory={() => setCurrentView('history')}
                                onNavigateToProjects={handleNavigateToProjects}
                                onNavigateToSettings={() => setCurrentView('settings')}
                                onNavigateToCustomers={() => setCurrentView('customers')}
                                onNavigateToPlanning={() => setCurrentView('planning')}
                                onNavigateToCalendar={() => setCurrentView('calendar')}
                                user={user}   // [NEW]
                                tenant={tenant} // [NEW]
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
                                    <JbwosBoard
                                        onClose={handleNavigateToProjects}
                                        initialLayoutMode={initialDashboardLayout} // [NEW]
                                    />
                                </div>
                            )}

                            {/* 1.5 Project Registry (New) */}
                            {currentView === 'projects' && (
                                <ProjectRegistryScreen
                                    onSelect={(id) => {
                                        console.log('[App] Selected Cloud Project:', id);
                                        handleOpenCloudProject(id);
                                    }}
                                    onBack={handleBackToDashboard}
                                />
                            )}

                            {/* 2. Project List (External View) - Legacy */}
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
                                    onDeleteProject={handleDeleteProject}
                                    onArchiveProject={handleArchiveProject}
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
                                <TodayScreen
                                    onBack={() => setCurrentView('jbwos')}
                                    onNavigateToPlanning={() => setCurrentView('planning')} // [NEW]
                                />
                            )}

                            {/* 6.1 Volume Calendar (Workload Visualization) */}
                            {currentView === 'calendar' && (
                                <VolumeCalendarScreen
                                    onNavigateHome={handleBackToDashboard}
                                />
                            )}


                            {/* 6.5 Planning (Future Board) */}
                            {currentView === 'planning' && (
                                <FutureBoard
                                    onClose={() => setCurrentView('jbwos')} // Back to JBWOS
                                />
                            )}

                            {/* 7. History Screen */}
                            {currentView === 'history' && (
                                <HistoryScreen onBack={() => setCurrentView('jbwos')} />
                            )}

                            {/* 8. Settings Screen */}
                            {currentView === 'settings' && (
                                <div className="h-full w-full overflow-auto">
                                    <SettingsScreen
                                        onBack={handleBackToDashboard}
                                        onNavigateToManual={() => setCurrentView('manual')}
                                    />
                                </div>
                            )}

                            {/* 9. Customer List (Customer Plugin) */}
                            {currentView === 'customers' && (
                                <div className="h-full w-full overflow-auto bg-slate-100 dark:bg-slate-950">
                                    <CustomerList />
                                </div>
                            )}

                            {/* 9.5 Company Settings */}
                            {currentView === 'companySettings' && (
                                <CompanySettingsScreen
                                    onNavigateHome={handleBackToDashboard}
                                />
                            )}

                            {/* 10. Manual Screen */}
                            {currentView === 'manual' && (
                                <div className="h-full w-full overflow-auto">
                                    <ManualScreen />
                                </div>
                            )}

                            {/* 11. User Management (Admin) */}
                            {currentView === 'userlist' && (
                                <div className="h-full w-full overflow-auto bg-slate-100 dark:bg-slate-900">
                                    <UserManagementScreen />
                                </div>
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
