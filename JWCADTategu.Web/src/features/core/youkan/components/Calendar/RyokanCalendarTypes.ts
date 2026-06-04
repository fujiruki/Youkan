import { Item, Member, CapacityConfig, JoinedTenant, CompanyAllocation } from '../../types';
import { ExternalEvent } from '../../types/externalEvent';
import { GoogleCalendar } from '../../../../../api/googleCalendar';

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
    onDeleteItem?: (id: string) => Promise<void> | void;
    // [NEW] Phase 24: Gantt Header integration
    onVisibleMonthChange?: (date: Date) => void; // Reports which month is currently in view
    onOpenDailySettings?: (date: Date) => void; // Opens DailyCapacityEditor for the given date
    showGroups?: boolean; // [NEW] Toggle project grouping in Gantt
    forceScroll?: boolean; // 明示的ナビゲーション時にrange内でもスクロール強制
    /** R-034 Phase 2: Google カレンダー外部イベント（date キー -> events） */
    externalEventsByDate?: Map<string, ExternalEvent[]>;
    /** R-034 Phase 2: グリッドビューのセル内に表示する最大件数（デフォルト 3） */
    externalEventsMaxVisible?: number;
    /** R-042-Y2: スクロール端で +N ヶ月の追加ロードを発火するコールバック */
    onLoadMore?: (direction: 'before' | 'after', months: number) => void;
    /** R-042-Y2: 追加ロード中フラグ（true のとき sentinel 発火を抑止する） */
    isLoadingMore?: boolean;
    /** R-042-Y2: 現在ロード済みの範囲（YYYY-MM-DD）。デバッグ／将来拡張用に保持 */
    loadedRange?: { from: string; to: string };
    /** R-041-Y3: イベントチップにカレンダー色を反映するための Google カレンダー一覧 */
    googleCalendars?: GoogleCalendar[];
}
