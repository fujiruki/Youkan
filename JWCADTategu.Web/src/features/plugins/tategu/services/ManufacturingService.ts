import { ApiClient } from '../../../../api/client';
import { Document, MasterItem, MasterCategory } from '../domain/ManufacturingTypes';

export class ManufacturingService {
    // --- Master Items ---

    public static async getMasters(category?: MasterCategory): Promise<MasterItem[]> {
        const query = category ? `?category=${category}` : '';
        return ApiClient.request<MasterItem[]>('GET', `/masters${query}`);
    }

    public static async getMaster(id: string): Promise<MasterItem> {
        return ApiClient.request<MasterItem>('GET', `/masters/${id}`);
    }

    public static async createMaster(item: Partial<MasterItem>): Promise<{ id: string; success: boolean }> {
        return ApiClient.request<{ id: string; success: boolean }>('POST', '/masters', item);
    }

    public static async updateMaster(id: string, updates: Partial<MasterItem>): Promise<{ success: boolean }> {
        return ApiClient.request<{ success: boolean }>('PUT', `/masters/${id}`, updates);
    }

    public static async deleteMaster(id: string): Promise<{ success: boolean }> {
        return ApiClient.request<{ success: boolean }>('DELETE', `/masters/${id}`);
    }

    // --- Documents ---

    public static async getDocuments(projectId: string): Promise<Document[]> {
        return ApiClient.request<Document[]>('GET', `/documents?projectId=${projectId}`);
    }

    public static async getDocument(id: string): Promise<Document> {
        return ApiClient.request<Document>('GET', `/documents/${id}`);
    }

    public static async createDocument(doc: Partial<Document>): Promise<{ id: string; success: boolean }> {
        return ApiClient.request<{ id: string; success: boolean }>('POST', '/documents', doc);
    }

    public static async updateDocument(id: string, updates: Partial<Document>): Promise<{ success: boolean }> {
        return ApiClient.request<{ success: boolean }>('PUT', `/documents/${id}`, updates);
    }

    public static async deleteDocument(id: string): Promise<{ success: boolean }> {
        return ApiClient.request<{ success: boolean }>('DELETE', `/documents/${id}`);
    }

    public static async convertToSales(estimateId: string): Promise<{ id: string; success: boolean }> {
        return ApiClient.request<{ id: string; success: boolean }>('POST', `/documents/${estimateId}/convert`);
    }
}
