import { useState } from 'react';
// import { DashboardScreen } from './components/Dashboard/DashboardScreen'; // Deprecated
import { GlobalDecisionBoard } from './components/Dashboard/GlobalDecisionBoard';
import { ProjectListScreen } from './components/Dashboard/ProjectListScreen';
import { JoineryScheduleScreen } from './components/Dashboard/JoineryScheduleScreen';
import { EditorScreen } from './components/Editor/EditorScreen';
import { Project, Door, db } from './db/db';
import { DebugBanner, DebugBannerSpacer } from './components/Debug/DebugBanner';
import { CatalogScreen } from './components/Catalog/CatalogScreen';

import { JbwosBoard } from './features/jbwos/components/GlobalBoard/GlobalBoard'; // [NEW] MVP Board

type ViewState = 'dashboard' | 'projectList' | 'schedule' | 'editor' | 'catalog' | 'jbwos';

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

    const handleOpenCatalog = () => {
        console.log('[App] Opening Catalog');
        setCurrentView('catalog');
    };

    return (
        <div className="h-screen w-screen bg-slate-950 text-slate-200 font-sans flex flex-col">

            <DebugBanner />
            <div className="bg-slate-800 text-white text-xs px-2 py-1 flex gap-4">
                {/* Temporary Nav for Dev */}
                <button onClick={handleNavigateToProjects}>Projects</button>
                <button onClick={() => setCurrentView('jbwos')}>JBWOS (MVP)</button>
            </div>
            <DebugBannerSpacer />

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
                        onDeleteProject={() => {/* separate handler or pass reload trigger */ }}
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
            </div>
        </div>
    );
}

export default App;
