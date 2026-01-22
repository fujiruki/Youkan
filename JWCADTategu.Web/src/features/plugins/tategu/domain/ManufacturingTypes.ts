// src/features/plugins/tategu/domain/ManufacturingTypes.ts

export type DocumentType = 'estimate' | 'sales' | 'invoice';
export type DocumentStatus = 'draft' | 'sent' | 'approved' | 'paid' | 'cancelled';
export type MasterCategory = 'material' | 'hardware' | 'labor' | 'other';

export interface CostDetail {
    materials?: {
        name: string;
        dimensions?: string; // e.g. "2000x30x20"
        volume?: number;
        unitPrice: number;
        cost: number;
    }[];
    laborCost?: number;
    laborHours?: number;
    otherCost?: number;
    markupRate?: number; // 掛率 (e.g. 1.3)
    calculatedPrice?: number; // 原価 * 掛率
    manualPrice?: number; // 決定売価 (Override)
}

export interface DocumentItem {
    id: string; // "ditem_..."
    documentId: string;
    tenantId: string;
    name: string;
    quantity: number;
    unitPrice: number; // Final selling price
    costDetail?: CostDetail;
    position: number;
}

export interface Document {
    id: string; // "doc_..."
    tenantId: string;
    projectId: string;
    type: DocumentType;
    status: DocumentStatus;
    issueDate: string; // YYYY-MM-DD
    totalAmount: number;
    taxRate: number;
    costTotal: number;
    profitRate: number;
    snapshotJson?: any;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
    items?: DocumentItem[];
}

export interface MasterItem {
    id: string; // "mst_..."
    tenantId: string;
    category: MasterCategory;
    name: string;
    unitPrice: number; // Standard Unit Price (or Cost)
    supplier?: string;
    imageUrl?: string;
    specs?: {
        length?: number;
        width?: number;
        thickness?: number;
        color?: string;
        [key: string]: any;
    };
    createdAt: number;
    updatedAt: number;
}
