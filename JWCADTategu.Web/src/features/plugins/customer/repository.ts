/**
 * Customer Plugin - Repository
 * 
 * 顧客データのCRUD操作を提供するリポジトリ
 */

import { Customer, CustomerCreateRequest, CustomerUpdateRequest, CustomerSearchOptions } from './types';

const API_BASE = '/api/customers';

/**
 * 顧客リポジトリ
 */
export const customerRepository = {
    /**
     * 全顧客を取得
     */
    async getAll(options?: CustomerSearchOptions): Promise<Customer[]> {
        const params = new URLSearchParams();
        if (options?.query) params.set('query', options.query);
        if (options?.paymentType) params.set('paymentType', options.paymentType);
        if (options?.limit) params.set('limit', options.limit.toString());
        if (options?.offset) params.set('offset', options.offset.toString());

        const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch customers');
        return response.json();
    },

    /**
     * 顧客を取得
     */
    async getById(id: string): Promise<Customer | null> {
        const response = await fetch(`${API_BASE}/${id}`);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Failed to fetch customer');
        return response.json();
    },

    /**
     * 顧客を作成
     */
    async create(data: CustomerCreateRequest): Promise<Customer> {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to create customer');
        return response.json();
    },

    /**
     * 顧客を更新
     */
    async update(id: string, data: CustomerUpdateRequest): Promise<Customer> {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to update customer');
        return response.json();
    },

    /**
     * 顧客を削除
     */
    async delete(id: string): Promise<void> {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete customer');
    }
};
