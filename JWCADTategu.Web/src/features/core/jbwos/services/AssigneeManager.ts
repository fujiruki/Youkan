import { Assignee } from '../types';

/**
 * 外注先（担当者）を管理するサービスクラス
 */
export class AssigneeManager {
    private static instance: AssigneeManager;
    private assignees: Assignee[] = [];

    private constructor() {
        this.loadFromLocalStorage();
    }

    public static getInstance(): AssigneeManager {
        if (!AssigneeManager.instance) {
            AssigneeManager.instance = new AssigneeManager();
        }
        return AssigneeManager.instance;
    }

    /**
     * すべての外注先を取得
     */
    public getAllAssignees(): Assignee[] {
        return [...this.assignees];
    }

    /**
     * 社内の担当者を取得
     */
    public getInternalAssignees(): Assignee[] {
        return this.assignees.filter(a => a.type === 'internal');
    }

    /**
     * 社外の担当者を取得
     */
    public getExternalAssignees(): Assignee[] {
        return this.assignees.filter(a => a.type === 'external');
    }

    /**
     * IDから外注先を取得
     */
    public getAssigneeById(id: string): Assignee | undefined {
        return this.assignees.find(a => a.id === id);
    }

    /**
     * 外注先を追加
     */
    public async addAssignee(assignee: Omit<Assignee, 'id' | 'createdAt'>): Promise<Assignee> {
        const newAssignee: Assignee = {
            ...assignee,
            id: `assignee-${Date.now()}`,
            createdAt: Date.now()
        };

        this.assignees.push(newAssignee);
        this.saveToLocalStorage();

        return newAssignee;
    }

    /**
     * 外注先を更新
     */
    public async updateAssignee(id: string, updates: Partial<Assignee>): Promise<void> {
        const index = this.assignees.findIndex(a => a.id === id);
        if (index === -1) {
            throw new Error(`Assignee with id ${id} not found`);
        }

        this.assignees[index] = {
            ...this.assignees[index],
            ...updates
        };

        this.saveToLocalStorage();
    }

    /**
     * 外注先を削除
     */
    public async deleteAssignee(id: string): Promise<void> {
        this.assignees = this.assignees.filter(a => a.id !== id);
        this.saveToLocalStorage();
    }

    /**
     * LocalStorageに保存
     */
    private saveToLocalStorage(): void {
        localStorage.setItem('jbwos-assignees', JSON.stringify(this.assignees));
    }

    /**
     * LocalStorageから読み込み
     */
    private loadFromLocalStorage(): void {
        const stored = localStorage.getItem('jbwos-assignees');
        if (stored) {
            try {
                this.assignees = JSON.parse(stored);
            } catch (e) {
                console.error('Failed to load assignees from localStorage', e);
                this.assignees = [];
            }
        }
    }
}

// シングルトンインスタンスをエクスポート
export const assigneeManager = AssigneeManager.getInstance();
