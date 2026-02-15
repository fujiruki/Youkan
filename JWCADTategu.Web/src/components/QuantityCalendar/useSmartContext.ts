import { useMemo } from 'react';

interface SmartContextProps {
    item: { isPrivate?: boolean } | null;
    globalFilter: string;
}

/**
 * Determines the appropriate context (All/Company/Personal) based on the current item and global filter.
 * 
 * Logic:
 * - No Item -> Return Global Filter
 * - Private Item -> Return 'personal' (Private tasks belong to personal capacity)
 * - Public Item (Work) -> 
 *      - If Global is 'personal' -> Return 'company' (Show work context as relevant)
 *      - Else -> Return Global Filter (Keep 'all' or 'company')
 */
export const useSmartContext = ({ item, globalFilter }: SmartContextProps): string => {
    return useMemo(() => {
        if (!item) return globalFilter;

        if (item.isPrivate) {
            return 'personal';
        }

        // Public Item
        if (globalFilter === 'personal') {
            return 'company';
        }

        return globalFilter;
    }, [item, globalFilter]);
};
