import { useState, useEffect, useCallback } from 'react';
import { Member } from '../types';
import { ApiClient } from '../../../../api/client';

export const useMembersViewModel = () => {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMembers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await ApiClient.getMembers();
            setMembers(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    const updateMember = async (id: string, updates: Partial<Member>) => {
        // Optimistic Update
        const previousMembers = [...members];
        setMembers(prev => prev.map(m =>
            m.id === id ? { ...m, ...updates } : m
        ));

        try {
            await ApiClient.updateMember(id, updates);
        } catch (err) {
            // Revert on failure
            setMembers(previousMembers);
            setError('Failed to update member');
            // Maybe show toast?
        }
    };

    return {
        members,
        loading,
        error,
        fetchMembers,
        updateMember
    };
};
