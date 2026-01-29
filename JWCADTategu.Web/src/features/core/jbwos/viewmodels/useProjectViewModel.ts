import { useState, useCallback, useEffect } from 'react';
import { Project, Assignee } from '../types';
import { ProjectService } from '../services/ProjectService';
import { useToast } from '../../../../contexts/ToastContext';
import { ApiClient } from '../../../../api/client';

export const useProjectViewModel = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [members, setMembers] = useState<Assignee[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { showToast } = useToast();

    const [activeScope, setActiveScope] = useState<'personal' | 'company'>(() => {
        // Initial state from URL
        const path = window.location.pathname.toLowerCase();
        if (path.includes('/projects/company')) return 'company';
        return 'personal';
    });

    // Update URL when activeScope changes
    const handleSetScope = useCallback((scope: 'personal' | 'company') => {
        setActiveScope(scope);
        // Force absolute path for the subdirectory deployment
        const deployBase = '/contents/TateguDesignStudio/';
        const newPath = `${deployBase}projects/${scope}`;
        window.history.pushState({ scope }, '', newPath);
    }, []);

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [projData, membersData] = await Promise.all([
                ProjectService.getAll({ scope: activeScope }),
                ApiClient.getAssignees()
            ]);
            setProjects(projData);
            setMembers(membersData);
        } catch (err: any) {
            setError(err.message);
            showToast({ title: 'エラー', message: 'データの取得に失敗しました', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [showToast, activeScope]);

    // Listen to popstate (back button)
    useEffect(() => {
        const handlePopState = () => {
            const path = window.location.pathname.toLowerCase();
            if (path.includes('/projects/company')) setActiveScope('company');
            else if (path.includes('/projects/personal')) setActiveScope('personal');
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const createProject = async (project: Partial<Project>) => {
        setLoading(true);
        try {
            const newProject = await ProjectService.create(project);
            showToast({ title: '成功', message: 'プロジェクトを作成しました', type: 'success' });
            await fetchProjects();
            return newProject;
        } catch (err: any) {
            showToast({ title: 'エラー', message: err.message, type: 'error' });
            return null;
        } finally {
            setLoading(false);
        }
    };

    const updateProject = async (id: string, updates: Partial<Project>) => {
        setLoading(true);
        try {
            await ProjectService.update(id, updates);
            showToast({ title: '成功', message: 'プロジェクトを更新しました', type: 'success' });
            await fetchProjects();
            return true;
        } catch (err: any) {
            showToast({ title: 'エラー', message: err.message, type: 'error' });
            return false;
        } finally {
            setLoading(false);
        }
    };

    const deleteProject = async (id: string) => {
        if (!window.confirm('本当にこのプロジェクトを削除しますか？')) return;

        setLoading(true);
        try {
            await ProjectService.delete(id);
            showToast({ title: '成功', message: 'プロジェクトを削除しました', type: 'success' });
            await fetchProjects();
        } catch (err: any) {
            showToast({ title: 'エラー', message: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const assignProject = async (projectId: string, assigneeId: string | null) => {
        try {
            await ProjectService.update(projectId, { assigned_to: assigneeId || '' } as any);
            showToast({ title: '割り当て完了', message: '担当者を更新しました', type: 'success' });
            await fetchProjects();
        } catch (err: any) {
            showToast({ title: 'エラー', message: '割り当てに失敗しました', type: 'error' });
        }
    };

    return {
        projects,
        members,
        loading,
        error,
        fetchProjects,
        createProject,
        updateProject,
        deleteProject,
        assignProject,
        activeScope,
        setActiveScope: handleSetScope
    };
};
