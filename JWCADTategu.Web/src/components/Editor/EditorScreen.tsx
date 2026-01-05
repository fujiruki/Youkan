
import React, { useEffect, useState } from 'react';
import { db, Door, Project } from '../../db/db';
import { useDoorViewModel } from '../../hooks/useDoorViewModel';
import { PreviewCanvas } from './PreviewCanvas';
import { Sidebar } from './Sidebar/Sidebar';
import { JWCADExporter } from '../../logic/JWCADExporter';
import { DoorGeometryGenerator } from '../../logic/GeometryGenerator';
import { EstimationPanel } from './EstimationPanel';
import { DefaultEstimationSettings } from '../../domain/EstimationSettings';
import { calculateCost } from '../../domain/EstimationService';
// Icons
import { Home, RotateCcw } from 'lucide-react';
import clsx from 'clsx';

type ViewMode = 'design' | 'pro';

export const EditorScreen: React.FC<{ doorId: number; onBack: () => void }> = ({ doorId, onBack }) => {
    const [initialDoor, setInitialDoor] = useState<Door | null>(null);
    const [initialProject, setInitialProject] = useState<Project | null>(null);

    useEffect(() => {
        const load = async () => {
            const d = await db.doors.get(doorId);
            if (d) {
                setInitialDoor(d);
                const p = await db.projects.get(d.projectId);
                setInitialProject(p || null);
            }
        };
        load();
    }, [doorId]);

    if (!initialDoor || !initialProject) return <div className="p-8 text-slate-400">Loading data...</div>;

    return <EditorContent initialDoor={initialDoor} initialProject={initialProject} onBack={onBack} />;
};

const EditorContent: React.FC<{ initialDoor: Door; initialProject: Project; onBack: () => void }> = ({ initialDoor, initialProject, onBack }) => {
    // State for Reset / Undo
    const initialSnapshot = React.useRef<Door>(initialDoor);
    const preResetSnapshot = React.useRef<Door | null>(null);
    const [isResetMode, setIsResetMode] = useState(false);

    // Ref for Thumbnail Capture (still needed for exit)
    const previewRef = React.useRef<{ toDataURL: () => string | null }>(null);

    // Expose replaceDoor
    const { door, updateDimension, updateDimensions, updateName, replaceDoor } = useDoorViewModel(initialDoor);
    const [project, setProject] = useState<Project>(initialProject);
    const [copyStatus, setCopyStatus] = useState<string>('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(door.name);

    // UI State
    const [viewMode, setViewMode] = useState<ViewMode>('design');

    // Calculated Cost for Header
    const settings = project.settings || DefaultEstimationSettings;
    const { unitPrice } = calculateCost(door.dimensions, settings);

    useEffect(() => {
        setTempName(door.name);
    }, [door.name]);

    // Auto-Save Effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            // Simply save current state to DB (without thumbnail for performance)
            if (door.id) {
                await db.doors.update(door.id, {
                    ...door,
                    updatedAt: new Date()
                });
            }
        }, 1000); // 1s Debounce

        return () => clearTimeout(timer);
    }, [door]);

    // Reset Logic
    const handleResetToggle = () => {
        if (!isResetMode) {
            // Enter Reset Mode: Backup current -> Restore Initial
            preResetSnapshot.current = JSON.parse(JSON.stringify(door));
            replaceDoor(initialSnapshot.current);
            setIsResetMode(true);
        } else {
            // Undo Reset: Restore Pre-Reset
            if (preResetSnapshot.current) {
                replaceDoor(preResetSnapshot.current);
            }
            setIsResetMode(false);
        }
    };

    // Exit Logic (Back Button)
    const handleFinalSaveAndExit = async () => {
        // Capture Thumbnail and Save one last time before exit
        let thumbnail: string | undefined;
        if (previewRef.current) {
            const dataUrl = previewRef.current.toDataURL();
            if (dataUrl) thumbnail = dataUrl;
        }

        const finalDoor = {
            ...door,
            updatedAt: new Date(),
            ...(thumbnail ? { thumbnail } : {})
        };

        if (door.id) {
            await db.doors.update(door.id, finalDoor);
        }

        onBack();
    };

    const handleCopy = async () => {
        try {
            const { lines } = DoorGeometryGenerator.generate(door.dimensions);
            const text = JWCADExporter.exportToText(lines);
            await navigator.clipboard.writeText(text);
            setCopyStatus('Copied!');
            setTimeout(() => setCopyStatus(''), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
            setCopyStatus('Error');
        }
    };

    const handleSettingsChange = (newSettings: any) => {
        const updated = { ...project, settings: newSettings };
        setProject(updated);
        if (project.id) {
            db.projects.update(project.id, { settings: newSettings });
        }
    };

    const handleNameSave = () => {
        updateName(tempName);
        setIsEditingName(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleNameSave();
        if (e.key === 'Escape') {
            setTempName(door.name);
            setIsEditingName(false);
        }
    };

    return (
        <div className="flex h-full flex-col bg-slate-950 text-slate-200">

            {/* 1. Header (Command Center) */}
            <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 z-20">
                {/* Left: Home & Name */}
                <div className="flex items-center gap-4 w-1/3">
                    <button
                        onClick={() => {
                            console.log('[EditorScreen] Back button clicked');
                            handleFinalSaveAndExit();
                        }}
                        className="text-slate-400 hover:text-white transition-colors"
                        title="Save & Back"
                    >
                        <Home size={20} />
                    </button>
                    <div className="h-6 w-px bg-slate-700 mx-2"></div>

                    {isEditingName ? (
                        <input
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onBlur={handleNameSave}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="bg-slate-800 border border-emerald-500 px-2 py-0.5 rounded text-white outline-none w-full max-w-[200px]"
                        />
                    ) : (
                        <h1
                            className="font-bold text-lg hover:text-emerald-400 cursor-pointer truncate"
                            onClick={() => setIsEditingName(true)}
                            title="Click to rename"
                        >
                            {door.name}
                        </h1>
                    )}
                </div>

                {/* Center: Mode Switch */}
                <div className="flex items-center justify-center w-1/3">
                    <div className="bg-slate-800 p-1 rounded-lg flex items-center">
                        <button
                            onClick={() => setViewMode('design')}
                            className={clsx(
                                "px-4 py-1 text-xs font-bold rounded-md transition-all",
                                viewMode === 'design'
                                    ? "bg-slate-700 text-emerald-400 shadow-sm"
                                    : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            Design
                        </button>
                        <button
                            onClick={() => setViewMode('pro')}
                            className={clsx(
                                "px-4 py-1 text-xs font-bold rounded-md transition-all",
                                viewMode === 'pro'
                                    ? "bg-slate-700 text-sky-400 shadow-sm"
                                    : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            Pro
                        </button>
                    </div>
                </div>

                {/* Right: Price & Reset */}
                <div className="flex items-center justify-end gap-6 w-1/3">
                    <div className="flex flex-col items-end leading-none">
                        <span className="text-[10px] text-slate-500 uppercase">Est. Price</span>
                        <span className="text-lg font-bold text-amber-400">¥ {unitPrice.toLocaleString()}</span>
                    </div>

                    {/* Reset / Undo Toggle */}
                    <button
                        onClick={handleResetToggle}
                        className={clsx(
                            "px-4 py-2 rounded-md font-bold text-sm flex items-center gap-2 transition-colors shadow-lg",
                            isResetMode
                                ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20"
                                : "bg-slate-700 hover:bg-slate-600 text-slate-200 shadow-slate-900/20"
                        )}
                    >
                        <RotateCcw size={16} className={clsx(isResetMode && "rotate-180")} />
                        {isResetMode ? '直前 (Undo)' : 'リセット (Reset)'}
                    </button>
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar */}
                <Sidebar
                    dimensions={door.dimensions}
                    onChange={updateDimension}
                    viewMode={viewMode}
                />

                {/* Center Canvas */}
                <div className="flex-1 relative bg-slate-950 flex flex-col">
                    {/* Toolbar Overlay (v2 placeholder) */}
                    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                        {/* <button className="p-2 bg-slate-800 rounded text-slate-400 hover:text-white opacity-50 hover:opacity-100"><Ruler size={16}/></button> */}
                    </div>



                    <div className="flex-1">
                        <PreviewCanvas
                            ref={previewRef}
                            dimensions={door.dimensions}
                            onDimensionsChange={updateDimensions}
                        />
                    </div>
                </div>

                {/* Right Panel (Pro Mode Only) */}
                <div
                    className={clsx(
                        "transition-all duration-300 ease-in-out border-l border-slate-800 bg-slate-900 flex flex-col",
                        viewMode === 'pro' ? "w-80 translate-x-0" : "w-0 translate-x-full opacity-0 overflow-hidden border-none"
                    )}
                >
                    <div className="flex-1 overflow-hidden h-full">
                        <EstimationPanel
                            dimensions={door.dimensions}
                            settings={settings}
                            onSettingsChange={handleSettingsChange}
                            onDimensionChange={updateDimension}
                        />
                    </div>

                    {/* Copy Action in Footer of Right Panel */}
                    <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
                        <button
                            onClick={handleCopy}
                            className="w-full py-2 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 rounded transition-colors text-xs flex items-center justify-center gap-2"
                        >
                            {copyStatus || 'Copy JWCAD Data'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
