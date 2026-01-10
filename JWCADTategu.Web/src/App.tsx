import { useState } from 'react';
import { DashboardScreen } from './components/Dashboard/DashboardScreen';
import { JoineryScheduleScreen } from './components/Dashboard/JoineryScheduleScreen';
import { EditorScreen } from './components/Editor/EditorScreen';
import { Project, Door } from './db/db';
import { DebugBanner } from './components/Debug/DebugBanner';
import { CatalogScreen } from './components/Catalog/CatalogScreen'; // [NEW]

type ViewState = 'dashboard' | 'schedule' | 'editor' | 'catalog'; // [NEW] catalog

function App() {
    const [currentView, setCurrentView] = useState<ViewState>('dashboard');
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [activeDoor, setActiveDoor] = useState<Door | null>(null);

    const handleOpenProject = (project: Project) => {
        console.log('[App] Opening Project:', project.id);
        setActiveProject(project);
        setCurrentView('schedule');
    };

    const handleOpenDoor = (door: Door) => {
        console.log('[App] Opening Door:', door.id);
        setActiveDoor(door);
        setCurrentView('editor');
    };

    const handleBackToDashboard = () => {
        console.log('[App] Back to Dashboard');
        setCurrentView('dashboard');
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
        <div className="h-screen w-screen bg-slate-950 text-slate-200 font-sans">
            <DebugBanner />
            {currentView === 'dashboard' && (
                <DashboardScreen
                    onOpenProject={handleOpenProject}
                    onOpenCatalog={handleOpenCatalog} // [NEW]
                />
            )}
            {currentView === 'schedule' && activeProject && (
                <JoineryScheduleScreen
                    project={activeProject}
                    onBack={handleBackToDashboard}
                    onOpenDoor={handleOpenDoor}
                    onDeleteProject={() => {/* separate handler or pass reload trigger */ }}
                    onUpdateProject={setActiveProject}
                />
            )}
            {currentView === 'editor' && activeDoor && (
                <EditorScreen
                    doorId={activeDoor.id!}
                    onBack={handleBackToSchedule}
                />
            )}
            {currentView === 'catalog' && (
                <CatalogScreen
                    onBack={handleBackToDashboard}
                />
            )}
        </div>
    );
}

export default App;
