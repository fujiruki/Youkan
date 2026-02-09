import { useState, useEffect } from 'react';
// import { DashboardScreen } from './components/Dashboard/DashboardScreen'; // Deprecated
// import { ProjectListScreen } from './features/plugins/tategu/screens/ProjectListScreen';
import { JoineryScheduleScreen } from './features/plugins/tategu/screens/JoineryScheduleScreen';
import { EditorScreen } from './features/plugins/tategu/editor/EditorScreen';
import { Project, Door, db } from './db/db';
import { DebugBanner } from './components/Debug/DebugBanner';
import { CatalogScreen } from './features/plugins/tategu/catalog/CatalogScreen';

import { DashboardScreen } from './features/core/jbwos/screens/DashboardScreen'; // [NEW] Unified Dashboard
// import { JbwosBoard } from './features/core/jbwos/components/GlobalBoard/GlobalBoard'; // [REPLACED]
// import { TodayScreen } from './features/core/jbwos/components/Today/TodayScreen'; // [REPLACED]
import { FutureBoard } from './features/core/planning/FutureBoard'; // [Keep for now]
import { HistoryScreen } from './features/core/jbwos/components/History/HistoryScreen'; // [NEW] History Screen
import { ArchiveTrashScreen } from './features/core/jbwos/screens/ArchiveTrashScreen'; // [NEW]
import { ProjectRegistryScreen } from './features/core/jbwos/screens/ProjectRegistryScreen'; // [RESTORED]
import { CustomerList } from './features/plugins/customer'; // [RESTORED]

import { UndoProvider } from './features/core/jbwos/contexts/UndoContext';
import { UndoToast } from './features/core/jbwos/components/UI/UndoToast';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ToastContainer } from './components/Toast/ToastContainer';
import { ApiClient } from './api/client';
import { JBWOSHeader } from './components/Layout/JBWOSHeader';
import { SettingsScreen } from './pages/SettingsScreen'; // [NEW]
import { CompanySettingsScreen } from './features/core/projects/screens/CompanySettingsScreen'; // [NEW]
import { PersonalSettingsScreen } from './features/core/jbwos/screens/PersonalSettingsScreen'; // [NEW]


import { ManualScreen } from './features/core/manual/ManualScreen'; // [NEW] Manuals
import { UserManagementScreen } from './features/admin/screens/UserManagementScreen'; // [NEW] User Management
import { ProjectCreationDialog } from './features/core/jbwos/components/Modal/ProjectCreationDialog';
import { useProjectViewModel } from './features/core/jbwos/viewmodels/useProjectViewModel';

// Auth Imports
// Auth Imports
import { AuthProvider, useAuth } from './features/core/auth/providers/AuthProvider';
import { LoginScreen } from './features/core/auth/screens/LoginScreen';
import { RegistrationScreen } from './pages/RegistrationScreen';
import { LogoutScreen } from './features/core/auth/screens/LogoutScreen';

import { VolumeCalendarScreen } from './features/core/calendar/screens/VolumeCalendarScreen'; // [NEW]

type ViewState = 'dashboard' | 'projectList' | 'projects' | 'schedule' | 'editor' | 'catalog' | 'jbwos' | 'today' | 'planning' | 'history' | 'archive' | 'trash' | 'settings' | 'customers' | 'manual' | 'userlist' | 'companySettings' | 'calendar' | 'personalSettings';

function App() {
    // Default is now Dashboard
    const [currentView, setCurrentView] = useState<ViewState>('dashboard');
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [activeDoor, setActiveDoor] = useState<Door | null>(null);

    // [NEW] URL Routing State


    // [NEW] URL Router Effect (Run Once)
    useEffect(() => {
        const path = window.location.pathname.toLowerCase();

        // ヘルパー: パスの末尾が一致するか、またはセグメントとして含まれているかを確認
        const matches = (segment: string) => path.endsWith(segment.toLowerCase()) || path.includes('/' + segment.toLowerCase() + '/');

        if (matches('dashboard') || matches('focus')) {
            console.log('[Router] Detected Dashboard/Focus URL');
            setCurrentView('dashboard');
        } else if (matches('jbwos/panorama') || matches('panorama')) {
            console.log('[Router] Detected Panorama URL');
            setCurrentView('dashboard'); // 現状はダッシュボードへリダイレクト（後にパノラマビュー実装時に切り替え）
        } else if (matches('projects/personal') || matches('projects/company') || matches('projects')) {
            console.log('[Router] Detected Projects URL');
            setCurrentView('projects');
        } else if (matches('calendar')) {
            console.log('[Router] Detected Calendar URL');
            setCurrentView('calendar');
        } else if (matches('history')) {
            console.log('[Router] Detected History URL');
            setCurrentView('history');
        } else if (matches('archive')) {
            console.log('[Router] Detected Archive URL');
            setCurrentView('archive');
        } else if (matches('trash')) {
            console.log('[Router] Detected Trash URL');
            setCurrentView('trash');
        } else if (matches('settings/profile') || matches('personalsettings')) {
            console.log('[Router] Detected Personal Settings URL');
            setCurrentView('personalSettings');
        } else if (matches('userlist')) {
            console.log('[Router] Detected UserList URL');
            setCurrentView('userlist');
        }
    }, []);



    // --- Navigation Handlers ---

    // 1. To Project List (External View)
    const handleNavigateToProjects = () => {
        setCurrentView('projects');
        setActiveProject(null);

        // Update URL
        const deployBase = '/contents/TateguDesignStudio/';
        window.history.pushState({ view: 'projects' }, '', `${deployBase}projects/personal`);
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
    const handleOpenCloudProject = (projectId: string, projectName?: string, tenantId?: string) => {
        console.log('[App] Opening Cloud Project:', projectId, 'Tenant:', tenantId);
        // Create a minimal Project object for JoineryScheduleScreen
        // Use the cloud ID as both:
        // - id: Generate a numeric ID from the string for local compatibility
        // - name: Store in a way we can retrieve (prefix with cloudId for now)
        const numericId = parseInt(projectId.replace(/[^0-9]/g, '').slice(-9) || '1', 10) || Date.now();
        const cloudProject: Project = {
            id: numericId,
            title: projectName || `[CLOUD:${projectId}]`,
            name: projectName || `[CLOUD:${projectId}]`, // Keep for legacy
            cloudId: projectId, // [NEW] Store original UUID
            tenantId: tenantId, // [fix] Pass tenantId
            client: '',
            updatedAt: new Date(),
            createdAt: new Date()
        };
        setActiveProject(cloudProject);
        setCurrentView('dashboard'); // [CHANGE] Go to Dashboard for Projects
    };

    // 3. To Editor (Directly from Global Board or Schedule)
    const handleOpenDoor = (door: Door) => {
        console.log('[App] Opening Door:', door.id);
        setActiveDoor(door);
        setCurrentView('editor');
    };

    // 4. Back Home (Global Decision Board -> JBWOS -> Dashboard)
    const handleBackToDashboard = () => {
        console.log('[App] Back to Dashboard');
        setCurrentView('dashboard');
        setActiveProject(null);
    };

    // [NEW] Dashboard Navigation Handler (Force Reset)
    const handleNavigateToDashboard = () => {
        console.log('[App] handleNavigateToDashboard called');
        setCurrentView('dashboard');
        setActiveProject(null);

        // Update localStorage to ensure the next mount of DashboardScreen defaults to stream
        localStorage.setItem('jbwos_view_mode', 'stream');

        // Logic to reset URL to base/Focus
        const basePath = import.meta.env.BASE_URL || '/';
        const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';
        const newPath = normalizedBase + 'Focus';

        // Use window.history.pushState to update URL without full reload
        window.history.pushState({ view: 'dashboard', mode: 'stream' }, '', newPath);

        // Dispatch event to reset DashboardScreen internal state (if already mounted)
        window.dispatchEvent(handleNavigateToDashboardEvent());
    };

    // Helper for custom event
    const handleNavigateToDashboardEvent = () => new CustomEvent('dashboard-reset', { detail: { mode: 'stream' } });


    // 5. Back to Project List
    const handleBackToProjectList = () => {
        setCurrentView('projects');
        setActiveProject(null);

        const deployBase = '/contents/TateguDesignStudio/';
        window.history.pushState({ view: 'projects' }, '', `${deployBase}projects/personal`);
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
                        handleNavigateToDashboard={handleNavigateToDashboard}
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
    handleOpenCloudProject: (id: string, name?: string, tenantId?: string) => void;
    handleOpenDoor: (door: Door) => void;
    handleBackToDashboard: () => void;
    handleBackToProjectList: () => void;
    handleBackToSchedule: () => void;
    handleDeleteProject: (id: number) => Promise<void>;
    handleArchiveProject: (id: number) => Promise<void>;
    setActiveProject: (p: Project | null) => void;
    handleNavigateToDashboard: () => void;

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
    handleNavigateToDashboard,

}) => {
        const { showToast, toasts, dismissToast } = useToast();
        const { user, tenant, joinedTenants, switchTenant } = useAuth(); // [NEW] Fetch Auth Info
        const { createProject, activeScope } = useProjectViewModel();
        const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

        // Global Modal Logic
        useEffect(() => {
            const handleOpenModal = () => setIsProjectModalOpen(true);
            window.addEventListener('jbwos-open-project-modal', handleOpenModal);
            return () => window.removeEventListener('jbwos-open-project-modal', handleOpenModal);
        }, []);

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
                    <div className="h-screen w-full bg-slate-900 text-slate-200 font-sans flex flex-col">

                        <DebugBanner />
                        {/* Multi-layered Header: [Global Bar (Layer 1)] & [Navigation Bar (Layer 2)] */}
                        {/* Immersive Mode for Today Screen: Hide Global Header -> No, Today/Focus needs Header too */}
                        {(currentView === 'jbwos' || currentView === 'dashboard' || currentView === 'today' || currentView === 'planning' || currentView === 'history' || currentView === 'customers' || currentView === 'personalSettings' || currentView === 'calendar' || currentView === 'projects' || currentView === 'archive' || currentView === 'trash') && (
                            <JBWOSHeader
                                currentView={currentView as any}
                                onNavigateToToday={() => setCurrentView('today')}
                                onNavigateToDashboard={handleNavigateToDashboard}
                                onNavigateToHistory={() => setCurrentView('history')}
                                onNavigateToProjects={handleNavigateToProjects}
                                onNavigateToSettings={() => setCurrentView('settings')}
                                onNavigateToCustomers={() => setCurrentView('customers')}
                                onNavigateToPlanning={() => setCurrentView('planning')}
                                onNavigateToCalendar={() => setCurrentView('calendar')}
                                onNavigateToCompanySettings={() => setCurrentView('companySettings')}
                                onNavigateToPersonalSettings={() => setCurrentView('personalSettings')}
                                user={user}   // [NEW]
                                tenant={tenant} // [NEW]
                                joinedTenants={joinedTenants}
                                onSwitchTenant={switchTenant}
                                activeProject={activeProject} // [NEW] Pass active project context
                            />
                        )}

                        <div className={`flex-1 overflow-hidden relative ${currentView === 'dashboard' ? 'bg-[#FDFDFD]' : ''}`}>

                            {/* 1. Global Decision Board (Replaced by JBWOS) */}
                            {/* 
                      Old 'dashboard' view is deprecated. 
                      We use 'jbwos' as the main dashboard now.
                    */}

                            {/* 0. JBWOS Dashboard - Unified View (Stream/Focus) */}
                            {(currentView === 'jbwos' || currentView === 'dashboard' || currentView === 'today') && (
                                <DashboardScreen activeProject={activeProject} />
                            )}

                            {/* 1.5 Project Registry (New) - Unified View */}
                            {(currentView === 'projects' || currentView === 'projectList') && (
                                <ProjectRegistryScreen
                                    onSelect={(project) => {
                                        const pTitle = project.title || project.name;
                                        console.log('[App] Selected Cloud Project:', project.id, pTitle);
                                        // Fixed: Check if ID is a PURE numeric string before parsing
                                        // Using regex /^\d+$/ instead of just isNaN to avoid mangled UUIDs
                                        if (/^\d+$/.test(project.id)) {
                                            handleOpenProject(parseInt(project.id, 10));
                                        } else {
                                            handleOpenCloudProject(project.id, pTitle, project.tenantId);
                                        }
                                    }}
                                />
                            )}

                            {/* 2. Project List (Legacy) - REMOVED / Redirected above */}

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
                                    doorId={String(activeDoor.id!)}
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
                                <div className="h-full w-full overflow-auto bg-slate-50">
                                    <CompanySettingsScreen
                                        onNavigateHome={handleBackToDashboard}
                                    />
                                </div>
                            )}

                            {/* 10. Manual Screen */}
                            {currentView === 'manual' && (
                                <div className="h-full w-full overflow-auto">
                                    <ManualScreen />
                                </div>
                            )}

                            {/* 13. Archive & Trash */}
                            {currentView === 'archive' && (
                                <ArchiveTrashScreen mode="archive" onBack={handleBackToDashboard} />
                            )}
                            {currentView === 'trash' && (
                                <ArchiveTrashScreen mode="trash" onBack={handleBackToDashboard} />
                            )}

                            {/* 11. User Management (Admin) */}
                            {currentView === 'userlist' && (
                                <div className="h-full w-full overflow-auto bg-slate-100 dark:bg-slate-900">
                                    <UserManagementScreen />
                                </div>
                            )}

                            {/* 12. Personal Settings */}
                            {currentView === 'personalSettings' && (
                                <PersonalSettingsScreen
                                    onBack={handleBackToDashboard}
                                />
                            )}
                        </div>

                        {/* Global Undo Toast */}
                        <UndoToast />

                        {/* Global Project Creation Dialog */}
                        {isProjectModalOpen && (
                            <ProjectCreationDialog
                                isOpen={isProjectModalOpen}
                                onClose={() => setIsProjectModalOpen(false)}
                                onCreate={async (payload) => {
                                    await createProject(payload);
                                    setIsProjectModalOpen(false);
                                }}
                                activeScope={activeScope}
                                tenants={joinedTenants}
                                project={null}
                            />
                        )}
                    </div>
                </UndoProvider>
                <ToastContainer toasts={toasts} onDismiss={dismissToast} />
            </>
        );
    };

export default App;
