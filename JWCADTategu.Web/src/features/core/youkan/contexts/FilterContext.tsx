import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { FilterMode } from '../types';
import { YOUKAN_KEYS } from '../../session/youkanKeys';

// ---------- Types ----------
interface FilterContextType {
    filterMode: FilterMode;
    setFilterMode: (mode: FilterMode) => void;
    hideCompleted: boolean;
    setHideCompleted: (hide: boolean) => void;
    toggleCompleted: () => void;
}

// ---------- Context ----------
const FilterContext = createContext<FilterContextType | undefined>(undefined);

// ---------- Provider ----------
export const FilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // filterMode はセッション単位（ブラウザを開くたびに常に 'all' で始める）
    // localStorage には保存しない（前回値の引き継ぎなし）
    const [filterMode, setFilterModeState] = useState<FilterMode>('all');

    const [hideCompleted, setHideCompletedState] = useState(() => {
        return localStorage.getItem(YOUKAN_KEYS.HIDE_COMPLETED) === 'true';
    });

    // filterMode は localStorage 非永続化（毎セッション 'all' から開始）
    const setFilterMode = useCallback((mode: FilterMode) => {
        setFilterModeState(mode);
    }, []);

    const setHideCompleted = useCallback((hide: boolean) => {
        setHideCompletedState(hide);
        localStorage.setItem(YOUKAN_KEYS.HIDE_COMPLETED, String(hide));
    }, []);

    const toggleCompleted = useCallback(() => {
        setHideCompletedState(prev => {
            const next = !prev;
            localStorage.setItem(YOUKAN_KEYS.HIDE_COMPLETED, String(next));
            return next;
        });
    }, []);

    // 後方互換: FILTER_CHANGEイベントのdispatch
    // 旧コンポーネント（ScheduleBoard等）がまだイベントリスナーを使う場合に備えて
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('youkan:filter_change', {
            detail: { mode: filterMode, hideCompleted }
        }));
    }, [filterMode, hideCompleted]);

    return (
        <FilterContext.Provider value={{ filterMode, setFilterMode, hideCompleted, setHideCompleted, toggleCompleted }}>
            {children}
        </FilterContext.Provider>
    );
};

// ---------- Hook ----------
export const useFilter = () => {
    const context = useContext(FilterContext);
    if (!context) {
        throw new Error('useFilter must be used within a FilterProvider');
    }
    return context;
};
