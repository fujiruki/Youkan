import { Item, Member, CapacityConfig, JoinedTenant, CompanyAllocation } from '../../types';

export type RyokanDisplayMode = 'grid' | 'timeline' | 'gantt';

export interface PressureConnection {
    id: string;
    source: { x: number, y: number };
    target: { x: number, y: number };
    color: string;
    isOffScreen?: 'left' | 'right'; // [NEW] Indicates the target is out of the current view
}

export interface RyokanCalendarProps {
    items: Item[];
    completedItems?: Item[];
    onItemClick?: (item: Item) => void;
    capacityConfig?: CapacityConfig;
    members?: Member[];
    layoutMode?: 'panorama' | 'mini';
    displayMode?: RyokanDisplayMode;
    filterMode?: any;
    externalVolumeMap?: Map<string, number>;
    intensityScale?: number;
    onSelectDate?: (date: Date) => void;
    selectedDate?: Date | null;
    prepDate?: Date | null;
    focusDate?: Date | null;
    workDays?: number;
    rowHeight?: number;
    projects?: any[];
    focusedTenantId?: string | null; // Keep as string for selection
    focusedProjectId?: string | null;
    currentUserId?: string | null;
    joinedTenants?: JoinedTenant[]; // [Modified] Rich object
    // [NEW] Capacity Editing
    tenantProfiles?: Map<string, any>;
    onUpdateCapacityException?: (date: Date, totalMinutes: number, allocation: CompanyAllocation) => void;
    // [NEW] Volume-Only mode for detail modal
    volumeOnly?: boolean;
    targetItemId?: string;
    commitPeriod?: Date[]; // [NEW] Accurate Allocation List
    // [NEW] Unification Props
    hideHeader?: boolean;
    onDateClick?: (date: Date) => void; // Popover for list
    selectionMode?: 'due' | 'prep' | null; // For styling/behavior
    disablePressureLines?: boolean; // [NEW] Disable yellow pressure lines
    onUpdateItem?: (id: string, updates: Partial<Item>) => Promise<void> | void; // [NEW] For drag updates
    // [NEW] Phase 24: Gantt Header integration
    onVisibleMonthChange?: (date: Date) => void; // Reports which month is currently in view
    onOpenDailySettings?: (date: Date) => void; // Opens DailyCapacityEditor for the given date
    showGroups?: boolean; // [NEW] Toggle project grouping in Gantt
    forceScroll?: boolean; // 明示的ナビゲーション時にrange内でもスクロール強制
}
