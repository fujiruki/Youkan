import { useState, useEffect, useCallback } from 'react';
import { Assignee } from '../types';
import { AssigneeRepository } from '../repositories/AssigneeRepository';

export const useAssignees = () => {
    const [assignees, setAssignees] = useState<Assignee[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Repository instance (Memoized if needed, but stateless class is fine)
    const repository = new AssigneeRepository();

    const fetchAssignees = useCallback(async () => {
        setLoading(true);
        try {
            const data = await repository.getAll();
            setAssignees(data);
            setError(null);
        } catch (err) {
            console.error(err);
            setError('Failed to fetch assignees');
        } finally {
            setLoading(false);
        }
    }, []);

    const addAssignee = async (assignee: Omit<Assignee, 'id' | 'createdAt'>) => {
        try {
            const newOne = await repository.add(assignee);
            setAssignees(prev => [...prev, newOne]);
            return newOne;
        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    const updateAssignee = async (id: string, updates: Partial<Assignee>) => {
        try {
            await repository.update(id, updates);
            setAssignees(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    const deleteAssignee = async (id: string) => {
        try {
            await repository.delete(id);
            setAssignees(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    useEffect(() => {
        fetchAssignees();
    }, [fetchAssignees]);

    return {
        assignees,
        loading,
        error,
        refresh: fetchAssignees,
        addAssignee,
        updateAssignee,
        deleteAssignee
    };
};
