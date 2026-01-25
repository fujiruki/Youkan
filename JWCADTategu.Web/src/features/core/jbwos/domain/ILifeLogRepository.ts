export interface LifeItem {
    id: string;
    label: string;
    isCustom?: boolean;
}

export interface ILifeLogRepository {
    getCheckedItems(): Promise<Record<string, boolean>>;
    checkItem(itemId: string): Promise<{ checked: boolean }>;
    // Future expansion: getHistory(date: string), etc.
}
