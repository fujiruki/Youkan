import { useState } from 'react';
import { DashboardScreen } from './components/Dashboard/DashboardScreen';
import { JoineryScheduleScreen } from './components/Dashboard/JoineryScheduleScreen';
import { EditorScreen } from './components/Editor/EditorScreen';
import { Project, Door } from './db/db';

type ViewState = 'dashboard' | 'schedule' | 'editor';

function App() {
    const [currentView, setCurrentView] = useState<ViewState>('dashboard');
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [activeDoor, setActiveDoor] = useState<Door | null>(null);

    const handleOpenProject = (project: Project) => {
        setActiveProject(project);
        setCurrentView('schedule');
    };

    const handleOpenDoor = (door: Door) => {
        setActiveDoor(door);
        setCurrentView('editor');
    };

    const handleBackToDashboard = () => {
        setCurrentView('dashboard');
        setActiveProject(null);
    };

    const handleBackToSchedule = () => {
        setCurrentView('schedule');
        setActiveDoor(null);
    };

    return (
        <div className="h-screen w-screen bg-slate-950 text-slate-200 font-sans">
            {currentView === 'dashboard' && (
                <DashboardScreen onOpenProject={handleOpenProject} />
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
        </div>
    );
}

export default App;
