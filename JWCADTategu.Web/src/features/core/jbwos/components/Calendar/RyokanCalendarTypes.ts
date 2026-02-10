import { Item, Member, CapacityConfig } from '../../types';

export type RyokanDisplayMode = 'grid' | 'timeline' | 'gantt';

export interface PressureConnection {
    id: string;
    source: { x: number, y: number };
    target: { x: number, y: number };
    color: string;
}

export interface RyokanCalendarProps {
    items: Item[];
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
    focusedTenantId?: string | null;
    focusedProjectId?: string | null;
    currentUserId?: string | null;
    joinedTenants?: string[];
}
