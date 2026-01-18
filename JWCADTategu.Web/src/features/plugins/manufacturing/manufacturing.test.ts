/**
 * Manufacturing Plugin - Unit Tests
 * 
 * TDD: テストを先に書いて実装を進める
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Deliverable, DeliverableCreateRequest, ProjectSummary } from './types';

// モックfetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// テスト用モックデータ
const mockDeliverable: Deliverable = {
    id: 'dlv_test123',
    projectId: 'proj_abc',
    name: 'リビングドア',
    type: 'product',
    estimatedWorkMinutes: 480,
    estimatedSiteMinutes: 120,
    actualWorkMinutes: 500,
    actualSiteMinutes: 100,
    materialCost: 50000,
    laborCost: 30000,
    status: 'pending',
    requiresSiteInstallation: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
};

describe('Deliverable Types', () => {
    it('Deliverable should have required fields', () => {
        expect(mockDeliverable.id).toBeDefined();
        expect(mockDeliverable.projectId).toBeDefined();
        expect(mockDeliverable.name).toBeDefined();
        expect(mockDeliverable.type).toBeDefined();
        expect(mockDeliverable.estimatedWorkMinutes).toBeDefined();
        expect(mockDeliverable.estimatedSiteMinutes).toBeDefined();
        expect(mockDeliverable.status).toBeDefined();
    });

    it('DeliverableType should be product or service', () => {
        expect(['product', 'service']).toContain(mockDeliverable.type);
    });

    it('DeliverableStatus should be valid', () => {
        expect(['pending', 'in_progress', 'completed']).toContain(mockDeliverable.status);
    });
});

describe('Deliverable Repository', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe('getByProject', () => {
        it('should fetch deliverables for a project', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [mockDeliverable]
            });

            const { deliverableRepository } = await import('./repository');
            const deliverables = await deliverableRepository.getByProject('proj_abc');

            expect(mockFetch).toHaveBeenCalledWith('/api/deliverables?projectId=proj_abc');
            expect(deliverables).toHaveLength(1);
            expect(deliverables[0].name).toBe('リビングドア');
        });
    });

    describe('create', () => {
        it('should create a new deliverable', async () => {
            const newData: DeliverableCreateRequest = {
                projectId: 'proj_abc',
                name: '寝室ドア',
                type: 'product',
                estimatedWorkMinutes: 360,
                estimatedSiteMinutes: 90,
                status: 'pending',
                requiresSiteInstallation: true
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ...mockDeliverable, ...newData, id: 'dlv_new' })
            });

            const { deliverableRepository } = await import('./repository');
            const created = await deliverableRepository.create(newData);

            expect(mockFetch).toHaveBeenCalledWith('/api/deliverables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newData)
            });
            expect(created.name).toBe('寝室ドア');
        });
    });

    describe('getProjectSummary', () => {
        it('should fetch project summary', async () => {
            const summaryData: ProjectSummary = {
                projectId: 'proj_abc',
                deliverableCount: 3,
                totalEstimatedWorkMinutes: 1200,
                totalEstimatedSiteMinutes: 300,
                totalActualWorkMinutes: 1000,
                totalActualSiteMinutes: 280,
                totalMaterialCost: 150000,
                totalLaborCost: 90000,
                totalOutsourceCost: 0,
                completedCount: 1,
                inProgressCount: 1,
                pendingCount: 1
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => summaryData
            });

            const { deliverableRepository } = await import('./repository');
            const summary = await deliverableRepository.getProjectSummary('proj_abc');

            expect(mockFetch).toHaveBeenCalledWith('/api/deliverables/summary/proj_abc');
            expect(summary.deliverableCount).toBe(3);
            expect(summary.totalEstimatedWorkMinutes).toBe(1200);
        });
    });
});

describe('Manufacturing Business Logic', () => {
    it('製作時間と現場時間は分離されている', () => {
        // 製作時間 = 工場での作業
        // 現場時間 = 取付・施工
        const deliverable: Deliverable = {
            ...mockDeliverable,
            estimatedWorkMinutes: 480,  // 8時間の製作
            estimatedSiteMinutes: 120   // 2時間の取付
        };

        expect(deliverable.estimatedWorkMinutes).not.toBe(deliverable.estimatedSiteMinutes);
    });

    it('現場取付フラグがfalseなら現場時間は計上しない', () => {
        const deliverable: Deliverable = {
            ...mockDeliverable,
            requiresSiteInstallation: false,
            estimatedSiteMinutes: 0
        };

        expect(deliverable.requiresSiteInstallation).toBe(false);
        expect(deliverable.estimatedSiteMinutes).toBe(0);
    });

    it('原価はアバウト入力でも可', () => {
        const deliverable: Deliverable = {
            ...mockDeliverable,
            materialCost: 50000,  // 大体5万くらい
            laborCost: undefined,
            outsourceCost: undefined
        };

        // 材料費だけ入力されていてもOK
        expect(deliverable.materialCost).toBe(50000);
        expect(deliverable.laborCost).toBeUndefined();
    });
});

describe('TaskGenerationService', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('製作時間がある場合は製作タスクを生成する', async () => {
        const deliverable: Deliverable = {
            ...mockDeliverable,
            estimatedWorkMinutes: 480,
            estimatedSiteMinutes: 0,
            requiresSiteInstallation: false
        };

        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ id: 'task_1', title: `${deliverable.name} 製作` })
        });

        const { generateTasksFromDeliverable } = await import('./TaskGenerationService');
        const tasks = await generateTasksFromDeliverable(deliverable, 'テストプロジェクト');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(tasks).toHaveLength(1);
    });

    it('現場取付ありの場合は製作タスクと取付タスクを両方生成する', async () => {
        const deliverable: Deliverable = {
            ...mockDeliverable,
            estimatedWorkMinutes: 480,
            estimatedSiteMinutes: 120,
            requiresSiteInstallation: true
        };

        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'task_1', title: `${deliverable.name} 製作` })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'task_2', title: `${deliverable.name} 取付` })
            });

        const { generateTasksFromDeliverable } = await import('./TaskGenerationService');
        const tasks = await generateTasksFromDeliverable(deliverable, 'テストプロジェクト');

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(tasks).toHaveLength(2);
    });

    it('時間からWeightを自動決定する（60分以下はLight）', async () => {
        const deliverable: Deliverable = {
            ...mockDeliverable,
            estimatedWorkMinutes: 30,
            estimatedSiteMinutes: 0,
            requiresSiteInstallation: false
        };

        let capturedBody: any = null;
        mockFetch.mockImplementation(async (_url, options) => {
            capturedBody = JSON.parse(options?.body as string);
            return {
                ok: true,
                json: async () => ({ id: 'task_1', ...capturedBody })
            };
        });

        const { generateTasksFromDeliverable } = await import('./TaskGenerationService');
        await generateTasksFromDeliverable(deliverable);

        expect(capturedBody.weight).toBe(1); // Light
    });
});
