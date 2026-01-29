import { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../../../api/client';

export type ProjectTab = 'personal' | 'company';

export const useProjectListViewModel = () => {
    const [activeTab, setActiveTab] = useState<ProjectTab>('personal');
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProjects = useCallback(async (tab: ProjectTab) => {
        setLoading(true);
        setError(null);
        try {
            const data = await ApiClient.getProjects({ scope: tab });
            setProjects(data);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch projects');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProjects(activeTab);
    }, [activeTab, fetchProjects]);

    const setTab = (tab: ProjectTab) => {
        setActiveTab(tab);
    };

    const refresh = () => {
        fetchProjects(activeTab);
    };

    return {
        activeTab,
        setTab,
        projects,
        loading,
        error,
        refresh
    };
};
