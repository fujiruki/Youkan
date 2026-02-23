import { useState, useEffect } from 'react';
import { JoineryScheduleScreen } from './features/plugins/tategu/screens/JoineryScheduleScreen';
import { EditorScreen } from './features/plugins/tategu/editor/EditorScreen';
import { JoinedTenant, Project as LocalProject } from './features/core/jbwos/types';
import { DebugBanner } from './components/Debug/DebugBanner';
import { CatalogScreen } from './features/plugins/tategu/catalog/CatalogScreen';

import { DashboardScreen } from './features/core/jbwos/screens/DashboardScreen'; // [NEW] Unified Dashboard
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
import { AuthProvider, useAuth } from './features/core/auth/providers/AuthProvider';
import { LoginScreen } from './features/core/auth/screens/LoginScreen';
import { RegistrationScreen } from './pages/RegistrationScreen';
import { LogoutScreen } from './features/core/auth/screens/LogoutScreen';

import { VolumeCalendarScreen } from './features/core/calendar/screens/VolumeCalendarScreen'; // [NEW]
import { db, Door } from './db/db';

type ViewState = 'dashboard' | 'projectList' | 'projects' | 'schedule' | 'editor' | 'catalog' | 'jbwos' | 'today' | 'planning' | 'history' | 'archive' | 'trash' | 'settings' | 'customers' | 'manual' | 'userlist' | 'companySettings' | 'calendar' | 'personalSettings';

function App() {
	const [currentView, setCurrentView] = useState<ViewState>('dashboard');
	const [activeProject, setActiveProject] = useState<LocalProject | null>(null);
	const [activeDoor, setActiveDoor] = useState<Door | null>(null);

	// [NEW] URL Router Effect (Run Once)
	useEffect(() => {
		const path = window.location.pathname.toLowerCase();
		const params = new URLSearchParams(window.location.search);
		const projectIdFromUrl = params.get('projectId');
		const projectTitleFromUrl = params.get('title');
		const tenantIdFromUrl = params.get('tenantId');

		const matches = (segment: string) => path.endsWith(segment.toLowerCase()) || path.includes('/' + segment.toLowerCase() + '/');

		if (projectIdFromUrl && !activeProject) {
			console.log('[Router] Restoring Project Context from URL:', projectIdFromUrl);
			const numericId = parseInt(projectIdFromUrl.replace(/[^0-9]/g, '').slice(-9) || '1', 10) || Date.now();
			setActiveProject({
				id: numericId,
				title: projectTitleFromUrl || `[CLOUD:${projectIdFromUrl}]`,
				name: projectTitleFromUrl || `[CLOUD:${projectIdFromUrl}]`,
				cloudId: projectIdFromUrl,
				tenantId: tenantIdFromUrl || undefined,
				updatedAt: Date.now(),
				createdAt: Date.now(),
				viewMode: 'external',
				judgmentStatus: 'inbox',
				isArchived: false,
				grossProfitTarget: 0
			});
		}

		if (matches('dashboard') || matches('focus')) {
			setCurrentView('dashboard');
		} else if (matches('jbwos/panorama') || matches('panorama')) {
			setCurrentView('dashboard');
		} else if (matches('projects/personal') || matches('projects/company') || matches('projects')) {
			setCurrentView('projects');
		} else if (matches('calendar')) {
			setCurrentView('calendar');
		} else if (matches('history')) {
			setCurrentView('history');
		} else if (matches('archive')) {
			setCurrentView('archive');
		} else if (matches('trash')) {
			setCurrentView('trash');
		} else if (matches('settings/profile') || matches('personalsettings')) {
			setCurrentView('personalSettings');
		} else if (matches('userlist')) {
			setCurrentView('userlist');
		}
	}, []);

	const handleNavigateToProjects = (scope: 'personal' | 'company' = 'personal') => {
		setCurrentView('projects');
		const deployBase = '/contents/TateguDesignStudio/';
		const params = new URLSearchParams();
		if (activeProject?.cloudId) {
			params.set('projectId', activeProject.cloudId);
			if (activeProject.title) params.set('title', activeProject.title);
			if (activeProject.tenantId) params.set('tenantId', activeProject.tenantId);
		}
		const queryString = params.toString() ? `?${params.toString()}` : '';
		window.history.pushState({ view: 'projects', scope }, '', `${deployBase}projects/${scope}${queryString}`);
		window.dispatchEvent(new CustomEvent('youkan-filter-change', { detail: { mode: scope } }));
	};

	const handleOpenProject = async (projectId: number) => {
		try {
			const p = await db.projects.get(projectId);
			if (p) {
				const uiProject: LocalProject = {
					...p,
					id: p.id,
					title: p.title || p.name || 'Untitled',
					name: p.name || p.title || 'Untitled',
					isArchived: !!p.isArchived,
					grossProfitTarget: (p as any).grossProfitTarget || 0,
					createdAt: typeof p.createdAt === 'number' ? p.createdAt : (p.createdAt instanceof Date ? p.createdAt.getTime() : Date.now()),
					updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : (p.updatedAt instanceof Date ? p.updatedAt.getTime() : Date.now()),
					viewMode: (p.viewMode as any) || 'internal',
					judgmentStatus: (p.judgmentStatus as any) || 'inbox',
				};
				setActiveProject(uiProject);
				setCurrentView('schedule');
			}
		} catch (error) {
			console.error('[App] Failed to open project:', error);
		}
	};

	const handleOpenCloudProject = (projectId: string, projectName?: string, tenantId?: string) => {
		const numericId = parseInt(projectId.replace(/[^0-9]/g, '').slice(-9) || '1', 10) || Date.now();
		const cloudProject: LocalProject = {
			id: numericId,
			title: projectName || `[CLOUD:${projectId}]`,
			name: projectName || `[CLOUD:${projectId}]`,
			cloudId: projectId,
			tenantId: tenantId,
			updatedAt: Date.now(),
			createdAt: Date.now(),
			viewMode: 'external',
			judgmentStatus: 'inbox',
			isArchived: false,
			grossProfitTarget: 0
		};
		setActiveProject(cloudProject);
		setCurrentView('dashboard');
		const deployBase = '/contents/TateguDesignStudio/';
		const params = new URLSearchParams();
		params.set('projectId', projectId);
		if (projectName) params.set('title', projectName);
		if (tenantId) params.set('tenantId', tenantId);
		window.history.pushState({ view: 'dashboard', projectId }, '', `${deployBase}Focus?${params.toString()}`);
	};

	const handleOpenDoor = (door: Door) => {
		setActiveDoor(door);
		setCurrentView('editor');
	};

	const handleBackToDashboard = () => {
		setCurrentView('dashboard');
		setActiveProject(null);
	};

	const handleNavigateToDashboard = () => {
		setCurrentView('dashboard');
		localStorage.setItem('youkan_view_mode', 'stream');
		const basePath = import.meta.env.BASE_URL || '/';
		const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';
		const params = new URLSearchParams();
		if (activeProject?.cloudId) {
			params.set('projectId', activeProject.cloudId);
			if (activeProject.title) params.set('title', activeProject.title);
			if (activeProject.tenantId) params.set('tenantId', activeProject.tenantId);
		}
		const queryString = params.toString() ? `?${params.toString()}` : '';
		window.history.pushState({ view: 'dashboard', mode: 'stream' }, '', normalizedBase + 'Focus' + queryString);
		window.dispatchEvent(new CustomEvent('dashboard-reset', { detail: { mode: 'stream' } }));
	};

	const handleClearProjectFocus = () => {
		setActiveProject(null);
		handleNavigateToDashboard();
	};

	const handleBackToProjectList = () => {
		setCurrentView('projects');
		setActiveProject(null);
		const deployBase = '/contents/TateguDesignStudio/';
		window.history.pushState({ view: 'projects' }, '', `${deployBase}projects/personal`);
	};

	const handleBackToSchedule = () => {
		setCurrentView('schedule');
		setActiveDoor(null);
	};

	const handleDeleteProject = async (projectId: number) => {
		try {
			await db.projects.delete(projectId);
			const doors = await db.doors.where('projectId').equals(projectId).toArray();
			await db.doors.bulkDelete(doors.map(d => d.id!));
			setActiveProject(null);
			setCurrentView('projectList');
		} catch (error) {
			console.error('[App] Failed to delete project:', error);
		}
	};

	const handleArchiveProject = async (projectId: number) => {
		try {
			await db.projects.update(projectId, { isArchived: true });
			setActiveProject(null);
			setCurrentView('projectList');
			alert('プロジェクトをアーカイブしました。');
		} catch (error) {
			console.error('[App] Failed to archive project:', error);
		}
	};

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'j')) {
				e.preventDefault();
				handleBackToDashboard();
			}
			if ((e.ctrlKey || e.metaKey) && e.key === 't') {
				e.preventDefault();
				setCurrentView('today');
			}
		};
		window.addEventListener('keydown', handleKeyDown);

		const params = new URLSearchParams(window.location.search);
		const doorIdParam = params.get('doorId');
		if (doorIdParam) {
			const doorId = parseInt(doorIdParam, 10);
			if (!isNaN(doorId)) {
				(async () => {
					try {
						const door = await db.doors.get(doorId);
						if (door) {
							setActiveDoor(door);
							if (door.projectId) {
								const p = await db.projects.get(door.projectId);
								if (p) {
									setActiveProject({
										...p,
										id: p.id,
										title: p.title || p.name || 'Untitled',
										name: p.name || p.title || 'Untitled',
										isArchived: !!p.isArchived,
										grossProfitTarget: (p as any).grossProfitTarget || 0,
										createdAt: typeof p.createdAt === 'number' ? p.createdAt : (p.createdAt instanceof Date ? p.createdAt.getTime() : Date.now()),
										updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : (p.updatedAt instanceof Date ? p.updatedAt.getTime() : Date.now()),
										viewMode: (p.viewMode as any) || 'internal',
										judgmentStatus: (p.judgmentStatus as any) || 'inbox',
									} as LocalProject);
								}
							}
							setCurrentView('editor');
						}
					} catch (e) {
						console.error('[App] Failed to load deep link data:', e);
					}
				})();
			}
		}
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [activeProject]);

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
						handleClearProjectFocus={handleClearProjectFocus}
					/>
				</AuthGuard>
			</AuthProvider>
		</ToastProvider>
	);
}

const AuthGuard: React.FC<{ children: React.ReactNode; bypass?: boolean }> = ({ children, bypass }) => {
	const { isAuthenticated, isLoading } = useAuth();
	if (bypass) return <>{children}</>;
	if (isLoading) return <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white">Loading...</div>;
	if (!isAuthenticated) {
		if (window.location.pathname.endsWith('/register')) return <RegistrationScreen />;
		if (window.location.pathname.endsWith('/logout')) return <LogoutScreen />;
		return <LoginScreen />;
	}
	if (window.location.pathname.endsWith('/logout')) return <LogoutScreen />;
	return <>{children}</>;
};

const AppContent: React.FC<{
	currentView: ViewState;
	setCurrentView: (view: ViewState) => void;
	activeProject: LocalProject | null;
	activeDoor: Door | null;
	handleNavigateToProjects: (scope?: 'personal' | 'company') => void;
	handleOpenProject: (id: number) => Promise<void>;
	handleOpenCloudProject: (id: string, name?: string, tenantId?: string) => void;
	handleOpenDoor: (door: Door) => void;
	handleBackToDashboard: () => void;
	handleBackToProjectList: () => void;
	handleBackToSchedule: () => void;
	handleDeleteProject: (id: number) => Promise<void>;
	handleArchiveProject: (id: number) => Promise<void>;
	setActiveProject: (p: LocalProject | null) => void;
	handleNavigateToDashboard: () => void;
	handleClearProjectFocus: () => void;
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
	handleClearProjectFocus,
}) => {
		const { showToast, toasts, dismissToast } = useToast();
		const { user, tenant, joinedTenants, switchTenant } = useAuth();
		const { createProject, activeScope } = useProjectViewModel();
		const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

		const mappedTenants: JoinedTenant[] = (joinedTenants || []).map(t => ({
			id: String(t.id),
			name: String(t.name),
			title: String((t as any).title || t.name),
			role: String(t.role || 'member'),
			description: String((t as any).description || ''),
			capacityProfile: (t as any).config?.capacityProfile
		}));

		useEffect(() => {
			const handleOpenModal = () => setIsProjectModalOpen(true);
			window.addEventListener('jbwos-open-project-modal', handleOpenModal);
			return () => window.removeEventListener('jbwos-open-project-modal', handleOpenModal);
		}, []);

		useEffect(() => {
			ApiClient.setErrorHandler((error, method, path) => {
				if (error.message.includes('401') || error.message.includes('Unauthorized')) {
					const baseUrl = import.meta.env.BASE_URL || '/';
					const normalizedBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
					window.location.href = normalizedBase + 'logout';
					return;
				}
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
						{(currentView === 'jbwos' || currentView === 'dashboard' || currentView === 'today' || currentView === 'planning' || currentView === 'history' || currentView === 'customers' || currentView === 'personalSettings' || currentView === 'calendar' || currentView === 'projects' || currentView === 'archive' || currentView === 'trash') && (
							<JBWOSHeader
								currentView={currentView}
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
								user={user}
								tenant={tenant}
								joinedTenants={mappedTenants}
								onSwitchTenant={switchTenant}
								activeProject={activeProject}
								onClearProject={handleClearProjectFocus}
							/>
						)}

						<div className={`flex-1 overflow-hidden relative ${currentView === 'dashboard' ? 'bg-[#FDFDFD]' : ''}`}>
							{(currentView === 'jbwos' || currentView === 'dashboard' || currentView === 'today') && (
								<DashboardScreen activeProject={activeProject} />
							)}

							{(currentView === 'projects' || currentView === 'projectList') && (
								<ProjectRegistryScreen
									onSelect={(project) => {
										const pIdStr = String(project.id || '');
										if (/^\d+$/.test(pIdStr)) {
											handleOpenProject(parseInt(pIdStr, 10));
										} else {
											handleOpenCloudProject(pIdStr, project.title || project.name, project.tenantId);
										}
									}}
								/>
							)}

							{currentView === 'schedule' && activeProject && (
								<JoineryScheduleScreen
									project={activeProject}
									onBack={handleBackToProjectList}
									onOpenDoor={handleOpenDoor}
									onDeleteProject={handleDeleteProject}
									onArchiveProject={handleArchiveProject}
									onUpdateProject={setActiveProject}
								/>
							)}

							{currentView === 'editor' && activeDoor && (
								<EditorScreen
									doorId={String(activeDoor.id!)}
									onBack={handleBackToSchedule}
								/>
							)}

							{currentView === 'catalog' && (
								<CatalogScreen onBack={handleBackToDashboard} />
							)}

							{currentView === 'calendar' && (
								<VolumeCalendarScreen
									onNavigateHome={handleBackToDashboard}
									activeProjectId={activeProject?.cloudId || (activeProject?.id ? String(activeProject.id) : null)}
									activeTenantId={tenant?.id}
								/>
							)}

							{currentView === 'planning' && (
								<FutureBoard onClose={() => setCurrentView('dashboard')} />
							)}

							{currentView === 'history' && (
								<HistoryScreen onBack={() => setCurrentView('dashboard')} />
							)}

							{currentView === 'settings' && (
								<div className="h-full w-full overflow-auto">
									<SettingsScreen
										onBack={handleBackToDashboard}
										onNavigateToManual={() => setCurrentView('manual')}
									/>
								</div>
							)}

							{currentView === 'customers' && (
								<div className="h-full w-full overflow-auto bg-slate-100 dark:bg-slate-950">
									<CustomerList />
								</div>
							)}

							{currentView === 'companySettings' && (
								<div className="h-full w-full overflow-auto bg-slate-50">
									<CompanySettingsScreen onNavigateHome={handleBackToDashboard} />
								</div>
							)}

							{currentView === 'manual' && (
								<div className="h-full w-full overflow-auto">
									<ManualScreen />
								</div>
							)}

							{currentView === 'archive' && (
								<ArchiveTrashScreen mode="archive" onBack={handleBackToDashboard} />
							)}
							{currentView === 'trash' && (
								<ArchiveTrashScreen mode="trash" onBack={handleBackToDashboard} />
							)}

							{currentView === 'userlist' && (
								<div className="h-full w-full overflow-auto bg-slate-100 dark:bg-slate-900">
									<UserManagementScreen />
								</div>
							)}

							{currentView === 'personalSettings' && (
								<PersonalSettingsScreen onBack={handleBackToDashboard} />
							)}
						</div>

						<UndoToast />

						{isProjectModalOpen && (
							<ProjectCreationDialog
								isOpen={isProjectModalOpen}
								onClose={() => setIsProjectModalOpen(false)}
								onCreate={async (payload) => {
									await createProject(payload);
									setIsProjectModalOpen(false);
								}}
								activeScope={activeScope}
								tenants={mappedTenants}
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
