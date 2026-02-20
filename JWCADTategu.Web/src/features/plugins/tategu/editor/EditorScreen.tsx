import React, { useEffect, useState } from 'react';
import { db, Project, DoorPhoto } from '../../../../db/db'; // [MIGRATION] Keep db for photos only
import { DoorApiClient, Door } from '../../../../api/DoorApiClient'; // [CLOUD] Use API client
import { useDoorViewModel } from '../../../../hooks/useDoorViewModel';
import { PreviewCanvas } from './PreviewCanvas';
import { Sidebar } from './Sidebar/Sidebar';
import { JWCADExporter } from '../../../../logic/JWCADExporter';
import { DoorGeometryGenerator } from '../../../../logic/GeometryGenerator';
import { EstimationPanel } from './EstimationPanel';
import { DefaultEstimationSettings } from '../domain/EstimationSettings';
import { calculateCost } from '../domain/EstimationService';
import { TextureSettingsPanel } from './TextureSettingsPanel';
import { DoorTextureSpecs, defaultTextureSpecs, CatalogItem } from '../domain/DoorSpecs';
import { CatalogService } from '../domain/CatalogService';
import { PhotoPanel } from './PhotoPanel';
import { CatalogPicker } from './CatalogPicker';
import { SchedulePanel } from './SchedulePanel';
import { syncDeliverableChanges } from '../../manufacturing/StockIntegrationService';
import clsx from 'clsx';
import { Home, RotateCcw, BookTemplate, LayoutGrid, Settings, Calculator, Camera, SplitSquareHorizontal, Download, Calendar } from 'lucide-react';

// [CLOUD] doorId is now string (UUID from API)
export const EditorScreen: React.FC<{ doorId: string; onBack: () => void }> = ({ doorId, onBack }) => {
    const [initialDoor, setInitialDoor] = useState<Door | null>(null);
    const [initialProject, setInitialProject] = useState<Project | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                // [CLOUD] Fetch door from API instead of local DB
                const door = await DoorApiClient.get(doorId);
                setInitialDoor(door);

                // [CLOUD] Create fallback project (project data is managed separately)
                // TODO: Implement ProjectApiClient for full cloud support
                setInitialProject({
                    id: parseInt(door.projectId, 10) || 0,
                    title: 'Auto-Loaded Project',
                    name: 'Auto-Loaded Project',
                    grossProfitTarget: 0,
                    isArchived: false,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                } as any);
            } catch (e) {
                console.error('[EditorScreen] Failed to load door:', e);
                setError('Door not found or API error');
            }
        };
        load();
    }, [doorId]);

    if (error) return <div className="p-8 text-red-400 bg-slate-950 h-full">{error}</div>;
    if (!initialDoor) return <div className="p-8 text-slate-400 bg-slate-950 h-full">Loading...</div>;
    if (!initialProject) return <div className="p-8 text-slate-400 bg-slate-950 h-full">Loading project...</div>;

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
    const { door, updateDimension, updateDimensions, updateName, updateFields, replaceDoor } = useDoorViewModel(initialDoor);
    const [project, setProject] = useState<Project>(initialProject);
    const [copyStatus, setCopyStatus] = useState<string>('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(door.name);

    // UI State
    const [activeTab, setActiveTab] = useState<'dimensions' | 'visual' | 'estimation' | 'photo' | 'schedule'>('dimensions');
    const [textureSpecs, setTextureSpecs] = useState<DoorTextureSpecs>(
        initialDoor.specs?.texture || defaultTextureSpecs
    );
    // Photo State
    const [doorPhoto, setDoorPhoto] = useState<DoorPhoto | null>(null);
    const [isCompareMode, setIsCompareMode] = useState(false);

    // Catalog Modal State
    const [showCatalogModal, setShowCatalogModal] = useState(false);
    const [showCatalogPicker, setShowCatalogPicker] = useState(false); // [NEW]
    const [catalogForm, setCatalogForm] = useState({ category: 'General', tags: '' });

    // Calculated Cost for Header
    const settings = project.settings || DefaultEstimationSettings;
    const { unitPrice } = calculateCost(door.dimensions, settings);

    useEffect(() => {
        setTempName(door.name);
        if (initialDoor.id) {
            // Load Photo
            db.doorPhotos.where('doorId').equals(initialDoor.id).first().then(p => {
                if (p) setDoorPhoto(p);
            });
        }
    }, [initialDoor.id, door.name]);

    // Auto-Save Effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            // Simply save current state to DB (without thumbnail for performance)
            if (door.id) {
                // [CLOUD] Save via API instead of local IndexedDB
                await DoorApiClient.update(door.id, {
                    ...door,
                    specs: { ...door.specs, texture: textureSpecs },
                    updatedAt: new Date()
                });

                // [NEW] Sync changes to related JBWOS Tasks (Auto-save)
                try {
                    await syncDeliverableChanges(
                        {
                            id: String(door.id),
                            projectId: String(door.projectId || ''),
                            name: door.name,
                            type: 'product',
                            estimatedWorkMinutes: door.estimatedWorkMinutes || 0,
                            estimatedSiteMinutes: door.estimatedSiteMinutes || 0,
                            status: 'pending',
                            requiresSiteInstallation: !!door.estimatedSiteMinutes,
                            createdAt: door.createdAt.getTime(),
                            updatedAt: Date.now()
                        },
                        project.name
                    );
                } catch (e) {
                    console.error('[EditorScreen] Failed to auto-sync deliverable changes:', e);
                }
            }
        }, 1000); // 1s Debounce

        return () => clearTimeout(timer);
    }, [door, textureSpecs]);

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
            specs: { ...door.specs, texture: textureSpecs },
            updatedAt: new Date(),
            ...(thumbnail ? { thumbnail } : {})
        };

        if (door.id) {
            // [CLOUD] Save via API instead of local IndexedDB
            await DoorApiClient.update(door.id, finalDoor);

            // [NEW] Sync changes to related JBWOS Tasks (Manufacturing Plugin)
            // Convert Door to Deliverable-like object for sync
            try {
                await syncDeliverableChanges(
                    {
                        id: String(door.id),
                        projectId: String(door.projectId || ''),
                        name: door.name,
                        type: 'product',
                        estimatedWorkMinutes: door.estimatedWorkMinutes || 0,
                        estimatedSiteMinutes: door.estimatedSiteMinutes || 0,
                        status: 'pending',
                        requiresSiteInstallation: !!door.estimatedSiteMinutes,
                        createdAt: door.createdAt.getTime(),
                        updatedAt: Date.now()
                    },
                    project.name // Pass project title for task naming
                );
            } catch (e) {
                console.error('[EditorScreen] Failed to sync deliverable changes:', e);
            }
        }

        onBack();
    };

    const handlePhotoUpload = async (file: File) => {
        if (!door.id) return;

        // Resize/Compress logic could go here? For now save raw.
        // Create new DoorPhoto
        // [MIGRATION] DoorPhoto still uses local IndexedDB, needs numeric doorId
        const numericDoorId = parseInt(door.id, 10) || 0;
        const newPhoto: DoorPhoto = {
            doorId: numericDoorId,
            blob: file, // Store File directly (File extends Blob)
            mimeType: file.type,
            memo: '',
            createdAt: new Date()
        };

        if (doorPhoto?.id) {
            // Update
            await db.doorPhotos.update(doorPhoto.id, { blob: file, mimeType: file.type });
            setDoorPhoto({ ...doorPhoto, blob: file, mimeType: file.type });
        } else {
            // Add
            const id = await db.doorPhotos.add(newPhoto); // returns id
            setDoorPhoto({ ...newPhoto, id: Number(id) });
        }
    };

    const handlePhotoDelete = async () => {
        if (doorPhoto?.id) {
            await db.doorPhotos.delete(doorPhoto.id);
            setDoorPhoto(null);
            setIsCompareMode(false);
        }
    };

    const handlePhotoMemoChange = async (memo: string) => {
        if (doorPhoto?.id) {
            await db.doorPhotos.update(doorPhoto.id, { memo });
            setDoorPhoto(prev => prev ? { ...prev, memo } : null);
        }
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

    const handleSaveToCatalog = async () => {
        if (!previewRef.current) return;

        try {
            const thumbnail = previewRef.current.toDataURL() || '';
            const keywords = catalogForm.tags.split(',').map(s => s.trim()).filter(Boolean);

            // Prepare Catalog Item
            const catalogItem: Omit<CatalogItem, 'id' | 'createdAt' | 'updatedAt'> = {
                name: door.name,
                category: catalogForm.category,
                keywords: keywords,
                thumbnail: thumbnail,
                doorData: {
                    dimensions: door.dimensions,
                    specs: { ...door.specs, texture: textureSpecs }
                }
            };

            await CatalogService.add(catalogItem);
            setShowCatalogModal(false);
            alert('Saved to Catalog!');
        } catch (e) {
            console.error('Failed to save to catalog', e);
            alert('Error saving to catalog');
        }
    };

    const handleLoadFromCatalog = (item: CatalogItem) => {
        if (!item.doorData) return;

        // No blocking confirm for now to allow testing/smooth UX

        // Apply Template Data
        // Keep ID, keep ProjectID. Overwrite Dimensions, Specs.
        // What about Name? Maybe ask user? For now keep current name or append?
        // Let's keep current name to avoid confusion in Project context.

        if (item.doorData.dimensions) {
            updateDimensions(item.doorData.dimensions);
        }
        if (item.doorData.specs?.texture) {
            setTextureSpecs(item.doorData.specs.texture);
        }
        // TODO: Load other specs if any

        setShowCatalogPicker(false);
    };

    const handleSettingsChange = (newSettings: any) => {
        const updated = { ...project, settings: newSettings };
        setProject(updated);
        if (project.id) {
            db.projects.update(project.id, { settings: newSettings });
        }
    };

    const handleDoorUpdate = async (updates: Partial<Door>) => {
        updateFields(updates);
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
                    {/* Compare Toggle (Only if photo exists) */}
                    {doorPhoto && (
                        <button
                            onClick={() => setIsCompareMode(!isCompareMode)}
                            className={clsx(
                                "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold transition-all border",
                                isCompareMode
                                    ? "bg-purple-900/50 border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                                    : "bg-slate-900 border-slate-700 text-slate-500 hover:text-white"
                            )}
                        >
                            <SplitSquareHorizontal size={16} />
                            比較モード {isCompareMode ? 'ON' : 'OFF'}
                        </button>
                    )}

                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                        <button
                            onClick={() => setActiveTab('dimensions')}
                            className={clsx("px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2", activeTab === 'dimensions' ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white hover:bg-slate-800/50")}
                        >
                            <LayoutGrid size={16} />
                            寸法
                        </button>
                        <button
                            onClick={() => setActiveTab('visual')}
                            className={clsx("px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2", activeTab === 'visual' ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white hover:bg-slate-800/50")}
                        >
                            <Settings size={16} />
                            Visual
                        </button>
                        <button
                            onClick={() => setActiveTab('estimation')}
                            className={clsx("px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2", activeTab === 'estimation' ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white hover:bg-slate-800/50")}
                        >
                            <Calculator size={16} />
                            見積
                        </button>
                        <button
                            onClick={() => setActiveTab('photo')}
                            className={clsx("px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2", activeTab === 'photo' ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white hover:bg-slate-800/50")}
                        >
                            <Camera size={16} />
                            写真
                        </button>
                        <button
                            onClick={() => setActiveTab('schedule')}
                            className={clsx("px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2", activeTab === 'schedule' ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white hover:bg-slate-800/50")}
                        >
                            <Calendar size={16} />
                            日程
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
                    viewMode={activeTab === 'dimensions' ? 'design' : 'pro'}
                />

                {/* Center Area (Preview) */}
                <div className={clsx("flex-1 overflow-hidden relative", isCompareMode && doorPhoto ? "grid grid-cols-2" : "flex items-center justify-center")}>

                    {/* Canvas Container */}
                    <div className={clsx("relative w-full h-full bg-[#1a1a1a] flex items-center justify-center", isCompareMode && "border-r border-slate-700")}>
                        {/* Grid Background */}
                        <div
                            className="absolute inset-0 opacity-20 pointer-events-none"
                            style={{
                                backgroundImage: `linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)`,
                                backgroundSize: '20px 20px'
                            }}
                        ></div>

                        <PreviewCanvas
                            dimensions={door.dimensions}
                            ref={previewRef}
                            textureSpecs={textureSpecs}
                            onDimensionsChange={updateDimensions}
                        />
                    </div>

                    {/* Compare Photo View */}
                    {isCompareMode && doorPhoto && (
                        <div className="w-full h-full bg-black flex items-center justify-center relative overflow-hidden">
                            <img
                                src={URL.createObjectURL(doorPhoto.blob)}
                                className="max-w-full max-h-full object-contain"
                                alt="Comparison"
                            />
                            <div className="absolute top-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-xs font-mono">
                                Client Photo
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel (Pro & Design Mode) */}
                <div
                    className={clsx(
                        "transition-all duration-300 ease-in-out border-l border-slate-800 bg-slate-900 flex flex-col",
                        "w-80 translate-x-0"
                    )}
                >
                    <div className="flex-1 overflow-hidden h-full overflow-y-auto">
                        {activeTab === 'estimation' && (
                            <EstimationPanel
                                dimensions={door.dimensions}
                                settings={settings}
                                onSettingsChange={handleSettingsChange}
                                onDimensionChange={updateDimension}
                            />
                        )}
                        {activeTab === 'visual' && (
                            <TextureSettingsPanel
                                specs={textureSpecs}
                                onChange={setTextureSpecs}
                            />
                        )}
                        {activeTab === 'photo' && (
                            <PhotoPanel
                                photo={doorPhoto}
                                onUpload={handlePhotoUpload}
                                onDelete={handlePhotoDelete}
                                onMemoChange={handlePhotoMemoChange}
                            />
                        )}
                        {activeTab === 'schedule' && (
                            <SchedulePanel
                                door={door}
                                onChange={handleDoorUpdate}
                            />
                        )}
                    </div>

                    {/* Copy Action in Footer of Right Panel */}
                    <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
                        <button
                            onClick={handleCopy}
                            className="w-full py-2 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 rounded transition-colors text-xs flex items-center justify-center gap-2"
                        >
                            {copyStatus || 'Copy JWCAD Data'}
                        </button>

                        <button
                            onClick={() => setShowCatalogModal(true)}
                            className="mt-2 w-full py-2 bg-emerald-900/40 border border-emerald-800 text-emerald-400 hover:bg-emerald-900/60 hover:border-emerald-500 rounded transition-colors text-xs flex items-center justify-center gap-2"
                        >
                            <BookTemplate size={14} />
                            Save as Template (Catalog)
                        </button>

                        <button
                            onClick={() => setShowCatalogPicker(true)} // [NEW]
                            className="mt-2 w-full py-2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 rounded transition-colors text-xs flex items-center justify-center gap-2"
                        >
                            <Download size={14} />
                            Load from Catalog
                        </button>
                    </div>
                </div>
            </div >

            {/* Catalog Picker Modal [NEW] */}
            {
                showCatalogPicker && (
                    <CatalogPicker
                        onSelect={handleLoadFromCatalog}
                        onCancel={() => setShowCatalogPicker(false)}
                    />
                )
            }

            {/* Catalog Save Modal */}
            {
                showCatalogModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-96 shadow-2xl">
                            <h3 className="text-lg font-bold text-white mb-4">Register to Catalog</h3>

                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="text-xs text-slate-500 block mb-1">Name</label>
                                    <div className="text-slate-300 font-bold">{door.name}</div>
                                    <p className="text-[10px] text-slate-600">Door name is used. Change it in the header if needed.</p>
                                </div>

                                <div>
                                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                                    <select
                                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-emerald-500"
                                        value={catalogForm.category}
                                        onChange={e => setCatalogForm({ ...catalogForm, category: e.target.value })}
                                    >
                                        <option value="General">General</option>
                                        <option value="Shoji">Shoji (障子)</option>
                                        <option value="Door">Door (フラッシュ/框)</option>
                                        <option value="Window">Window (窓)</option>
                                        <option value="Furniture">Furniture (家具建具)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs text-slate-500 block mb-1">Keywords (comma separated)</label>
                                    <input
                                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm outline-none focus:border-emerald-500"
                                        placeholder="e.g. Modern, Living, Cedar"
                                        value={catalogForm.tags}
                                        onChange={e => setCatalogForm({ ...catalogForm, tags: e.target.value })}
                                    />
                                </div>

                                <div className="flex gap-2 mt-2">
                                    <button
                                        onClick={() => setShowCatalogModal(false)}
                                        className="flex-1 py-2 text-slate-400 hover:text-white border border-slate-700 rounded hover:bg-slate-800 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveToCatalog}
                                        className="flex-1 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 transition font-bold"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
