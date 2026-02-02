import { useMemo } from 'react';
import { Item } from '../../types';
import { Item } from '../../types';
import { useJBWOSViewModel } from '../../viewmodels/useJBWOSViewModel';

export type JBWOSViewModel = ReturnType<typeof useJBWOSViewModel>;

export interface NewspaperItemWrapper {
    id: string;
    type: 'item' | 'header';
    item: Item;
    project?: Item | null; // Projects are Items in ViewModel
    isHeader: boolean;
    depth: number;
}

export const useNewspaperItems = (viewModel: JBWOSViewModel): NewspaperItemWrapper[] => {
    const {
        gdbActive,
        gdbPreparation,
        gdbIntent,
        allProjects
    } = viewModel;

    return useMemo(() => {
        // 1. Gather all tasks
        const allItems = [
            ...gdbActive,
            ...gdbPreparation,
            ...gdbIntent,
            ...(viewModel.gdbLog || []) // [NEW] Include LOG (Completed items)
        ].filter(item => !item.isProject);

        // 2. Group by ProjectId
        const noProjectItems: Item[] = [];
        const projectItemMap = new Map<string, Item[]>();

        allItems.forEach(item => {
            if (!item.projectId) {
                noProjectItems.push(item);
            } else {
                const pid = item.projectId;
                if (!projectItemMap.has(pid)) {
                    projectItemMap.set(pid, []);
                }
                projectItemMap.get(pid)?.push(item);
            }
        });

        // 3. Sort Projects (Company -> Personal)
        const companyProjects: Item[] = [];
        const personalProjects: Item[] = [];

        allProjects.forEach((p: Item) => {
            if (p.tenantId) {
                companyProjects.push(p);
            } else {
                personalProjects.push(p);
            }
        });

        const result: NewspaperItemWrapper[] = [];

        // 3.1 No Project Items
        noProjectItems.forEach(item => {
            result.push({
                id: item.id,
                type: 'item',
                item,
                isHeader: false,
                depth: 0
            });
        });

        const processProjects = (projects: Item[]) => {
            projects.forEach(p => {
                const tasks = projectItemMap.get(p.id) || [];
                if (tasks.length > 0) {
                    // Add Header
                    result.push({
                        id: `header-${p.id}`,
                        type: 'header',
                        isHeader: true,
                        item: {
                            id: `virtual-header-${p.id}`,
                            title: p.title, // [FIX] name -> title
                            status: 'inbox',
                            isProject: true,
                            projectId: p.id,
                            createdAt: 0,
                            updatedAt: 0,
                            statusUpdatedAt: 0,
                            focusOrder: 0,
                            isEngaged: false,
                            interrupt: false,
                            weight: 1
                        },
                        project: p,
                        depth: 0
                    });

                    tasks.forEach(task => {
                        result.push({
                            id: task.id,
                            type: 'item',
                            item: task,
                            project: p,
                            isHeader: false,
                            depth: 1
                        });
                    });
                }
            });
        };

        // 3.2 Company Projects
        processProjects(companyProjects);

        // 3.3 Personal Projects
        processProjects(personalProjects);

        return result;

    }, [gdbActive, gdbPreparation, gdbIntent, allProjects]);
};
