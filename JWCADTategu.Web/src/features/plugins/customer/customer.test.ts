/**
 * Customer Plugin - Unit Tests
 * 
 * TDD: テストを先に書いて実装を進める
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Customer, CustomerCreateRequest, PaymentType } from './types';

// モックfetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// テスト用のモックデータ
const mockCustomer: Customer = {
    id: 'cust_test123',
    name: '山田建設',
    nameKana: 'ヤマダケンセツ',
    address: '東京都新宿区...',
    phone: '03-1234-5678',
    email: 'yamada@example.com',
    closingDay: 20,
    paymentType: 'credit',
    carryOver: 50000,
    memo: 'テストメモ',
    createdAt: Date.now(),
    updatedAt: Date.now()
};

describe('Customer Types', () => {
    it('PaymentType should be credit or cash', () => {
        const creditType: PaymentType = 'credit';
        const cashType: PaymentType = 'cash';

        expect(creditType).toBe('credit');
        expect(cashType).toBe('cash');
    });

    it('Customer should have required fields', () => {
        expect(mockCustomer.id).toBeDefined();
        expect(mockCustomer.name).toBeDefined();
        expect(mockCustomer.paymentType).toBeDefined();
        expect(mockCustomer.createdAt).toBeDefined();
        expect(mockCustomer.updatedAt).toBeDefined();
    });

    it('Customer should have optional fields', () => {
        const minimalCustomer: Customer = {
            id: 'cust_min',
            name: '最小顧客',
            paymentType: 'cash',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        expect(minimalCustomer.nameKana).toBeUndefined();
        expect(minimalCustomer.address).toBeUndefined();
        expect(minimalCustomer.closingDay).toBeUndefined();
    });
});

describe('Customer Repository', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe('getAll', () => {
        it('should fetch all customers', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [mockCustomer]
            });

            const { customerRepository } = await import('./repository');
            const customers = await customerRepository.getAll();

            expect(mockFetch).toHaveBeenCalledWith('/api/customers');
            expect(customers).toHaveLength(1);
            expect(customers[0].name).toBe('山田建設');
        });

        it('should fetch customers with search query', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [mockCustomer]
            });

            const { customerRepository } = await import('./repository');
            await customerRepository.getAll({ query: '山田' });

            expect(mockFetch).toHaveBeenCalledWith('/api/customers?query=%E5%B1%B1%E7%94%B0');
        });

        it('should filter by payment type', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [mockCustomer]
            });

            const { customerRepository } = await import('./repository');
            await customerRepository.getAll({ paymentType: 'credit' });

            expect(mockFetch).toHaveBeenCalledWith('/api/customers?paymentType=credit');
        });
    });

    describe('getById', () => {
        it('should fetch a single customer', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockCustomer
            });

            const { customerRepository } = await import('./repository');
            const customer = await customerRepository.getById('cust_test123');

            expect(mockFetch).toHaveBeenCalledWith('/api/customers/cust_test123');
            expect(customer?.name).toBe('山田建設');
        });

        it('should return null for non-existent customer', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404
            });

            const { customerRepository } = await import('./repository');
            const customer = await customerRepository.getById('non_existent');

            expect(customer).toBeNull();
        });
    });

    describe('create', () => {
        it('should create a new customer', async () => {
            const newCustomer: CustomerCreateRequest = {
                name: '新規顧客',
                paymentType: 'cash'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ...mockCustomer, ...newCustomer, id: 'cust_new' })
            });

            const { customerRepository } = await import('./repository');
            const created = await customerRepository.create(newCustomer);

            expect(mockFetch).toHaveBeenCalledWith('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCustomer)
            });
            expect(created.name).toBe('新規顧客');
        });
    });

    describe('update', () => {
        it('should update an existing customer', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ ...mockCustomer, name: '更新後の名前' })
            });

            const { customerRepository } = await import('./repository');
            const updated = await customerRepository.update('cust_test123', { name: '更新後の名前' });

            expect(mockFetch).toHaveBeenCalledWith('/api/customers/cust_test123', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: '更新後の名前' })
            });
            expect(updated.name).toBe('更新後の名前');
        });
    });

    describe('delete', () => {
        it('should delete a customer', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true
            });

            const { customerRepository } = await import('./repository');
            await expect(customerRepository.delete('cust_test123')).resolves.not.toThrow();

            expect(mockFetch).toHaveBeenCalledWith('/api/customers/cust_test123', {
                method: 'DELETE'
            });
        });
    });
});

describe('Customer Business Logic', () => {
    it('締め日が0の場合は月末を意味する', () => {
        const customer: Customer = {
            ...mockCustomer,
            closingDay: 0
        };

        // 月末 = closingDay が 0 または undefined
        const isMonthEnd = customer.closingDay === 0 || customer.closingDay === undefined;
        expect(isMonthEnd).toBe(true);
    });

    it('掛売上顧客は締め日が必須', () => {
        const creditCustomer: Customer = {
            ...mockCustomer,
            paymentType: 'credit',
            closingDay: 20
        };

        // ビジネスルール: 掛売上なら締め日が必要
        const isValidCreditCustomer =
            creditCustomer.paymentType !== 'credit' ||
            creditCustomer.closingDay !== undefined;

        expect(isValidCreditCustomer).toBe(true);
    });
});
