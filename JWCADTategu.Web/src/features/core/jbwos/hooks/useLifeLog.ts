import { useState, useEffect, useCallback } from 'react';
import { LifeLogRepository } from '../repositories/LifeLogRepository';
import { LifeItem } from '../domain/ILifeLogRepository';

// Static defaults can be moved to Config/Consts later
const DEFAULT_ITEMS: LifeItem[] = [
    { id: 'clean', label: '掃除・換気' },
    { id: 'laundry', label: '洗濯・衣類整理' },
    { id: 'dishes', label: '食器洗い・片付け' },
    { id: 'rest', label: '十分な休憩' },
];

export const useLifeLog = () => {
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [customItems, setCustomItems] = useState<LifeItem[]>([]); // To be implemented via Preferences API
    const [loading, setLoading] = useState(false);

    const repository = new LifeLogRepository();

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const logs = await repository.getCheckedItems();
            setCheckedItems(logs);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const toggleCheck = async (itemId: string) => {
        // Optimistic
        setCheckedItems(prev => {
            const next = { ...prev };
            if (next[itemId]) delete next[itemId];
            else next[itemId] = true;
            return next;
        });

        try {
            const res = await repository.checkItem(itemId);
            // Reconcile if needed, but optimistic usually fine
            setCheckedItems(prev => {
                const next = { ...prev };
                if (res.checked) next[itemId] = true;
                else delete next[itemId];
                return next;
            });
        } catch (err) {
            console.error(err);
            fetchLogs(); // Rollback
        }
    };

    useEffect(() => {
        fetchLogs();
        // Load custom items from User Preferences (Not implemented yet in repo/controller fully, skip for MVP)
    }, [fetchLogs]);

    return {
        items: [...DEFAULT_ITEMS, ...customItems],
        checkedItems,
        loading,
        toggleCheck
    };
};
