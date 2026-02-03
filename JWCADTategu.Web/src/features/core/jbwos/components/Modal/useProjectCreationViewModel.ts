import { useState, useEffect } from 'react';
import { Project } from '../../types';

export interface ProjectCreationContext {
    parentProject?: Project | null;
    activeScope?: 'personal' | 'company';
    defaultTenantId?: string;
    joinedTenants: { id: string; name: string }[];
    initialData?: Project | null; // [NEW] For editing
}

export const useProjectCreationViewModel = (context: ProjectCreationContext) => {
    // Mode: 'child' (create under parent) or 'root' (create independent)
    const [creationMode, setCreationMode] = useState<'child' | 'root'>('root');

    // Form State
    const [name, setName] = useState('');
    const [clientName, setClientName] = useState('');
    const [grossProfitTarget, setGrossProfitTarget] = useState('0');
    const [color, setColor] = useState('#6366f1');
    const [selectedTenantId, setSelectedTenantId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize state based on context
    useEffect(() => {
        if (context.initialData) {
            // Edit Mode
            setName(context.initialData.title || context.initialData.name || '');
            setClientName(context.initialData.clientName || context.initialData.client || '');
            setGrossProfitTarget(context.initialData.grossProfitTarget?.toString() || '0');
            setColor(context.initialData.color || '#6366f1');
            setSelectedTenantId(context.initialData.tenantId || '');
            // Mode is irrelevant for editing, usually we don't change hierarchy in simple edit
            setCreationMode(context.initialData.parentId ? 'child' : 'root');
        } else if (context.parentProject) {
            setCreationMode('child');
            // If child, tenant is strictly parent's tenant
            setSelectedTenantId(context.parentProject.tenantId || '');

            // Should also inherit some defaults
            if (context.parentProject.clientName) {
                setClientName(context.parentProject.clientName);
            }
        } else {
            setCreationMode('root');
            // Default tenant logic
            if (context.activeScope === 'company') {
                setSelectedTenantId(context.defaultTenantId || (context.joinedTenants.length > 0 ? context.joinedTenants[0].id : ''));
            } else {
                setSelectedTenantId(''); // Personal
            }
        }
    }, [context.parentProject, context.activeScope, context.defaultTenantId, context.initialData]);

    // When toggling mode from child -> root, enable tenant selection
    useEffect(() => {
        if (creationMode === 'root') {
            if (context.activeScope === 'company' && !selectedTenantId) {
                setSelectedTenantId(context.defaultTenantId || (context.joinedTenants.length > 0 ? context.joinedTenants[0].id : ''));
            }
        } else if (creationMode === 'child' && context.parentProject) {
            // Revert to parent's tenant
            setSelectedTenantId(context.parentProject.tenantId || '');
        }
    }, [creationMode, context.activeScope]);

    const getEffectiveTenantId = () => {
        if (creationMode === 'child' && context.parentProject) {
            return context.parentProject.tenantId || null;
        }
        return context.activeScope === 'company' ? selectedTenantId : null;
    };

    const getEffectiveParentId = () => {
        return (creationMode === 'child' && context.parentProject) ? context.parentProject.id : undefined;
    };

    return {
        // State
        creationMode,
        name,
        clientName,
        grossProfitTarget,
        color,
        selectedTenantId,
        isSubmitting,

        // Setters
        setCreationMode,
        setName,
        setClientName,
        setGrossProfitTarget,
        setColor,
        setSelectedTenantId,
        setIsSubmitting,

        // Computed
        getEffectiveTenantId,
        getEffectiveParentId,

        // Helper
        canSelectTenant: creationMode === 'root' && context.activeScope === 'company',
        showLocationSelector: !!context.parentProject,
        parentProjectName: context.parentProject?.title || context.parentProject?.name
    };
};
