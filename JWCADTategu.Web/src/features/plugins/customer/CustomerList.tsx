/**
 * Customer Plugin - Customer List Component
 * 
 * 顧客一覧画面
 */
import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Phone, Mail, CreditCard, Banknote } from 'lucide-react';
import { Customer } from './types';
import { customerRepository } from './repository';
import { CustomerEditModal } from './CustomerEditModal';

export const CustomerList: React.FC = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // 顧客一覧を取得
    const loadCustomers = async () => {
        setLoading(true);
        try {
            const data = await customerRepository.getAll({ query: searchQuery || undefined });
            setCustomers(data);
        } catch (e) {
            console.error('Failed to load customers', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCustomers();
    }, [searchQuery]);

    // 顧客を保存（作成または更新）
    const handleSave = async (customer: Customer) => {
        try {
            if (isCreating) {
                await customerRepository.create({
                    name: customer.name,
                    nameKana: customer.nameKana,
                    address: customer.address,
                    phone: customer.phone,
                    email: customer.email,
                    closingDay: customer.closingDay,
                    paymentType: customer.paymentType,
                    carryOver: customer.carryOver,
                    memo: customer.memo
                });
            } else {
                await customerRepository.update(customer.id, customer);
            }
            setEditingCustomer(null);
            setIsCreating(false);
            loadCustomers();
        } catch (e) {
            console.error('Failed to save customer', e);
        }
    };

    // 顧客を削除
    const handleDelete = async (id: string) => {
        if (!confirm('この顧客を削除しますか？')) return;
        try {
            await customerRepository.delete(id);
            loadCustomers();
        } catch (e) {
            console.error('Failed to delete customer', e);
        }
    };

    return (
        <div className="p-4 lg:p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Users className="text-indigo-500" size={28} />
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                        顧客管理
                    </h1>
                </div>
                <button
                    onClick={() => {
                        setIsCreating(true);
                        setEditingCustomer({
                            id: '',
                            name: '',
                            paymentType: 'credit',
                            createdAt: Date.now(),
                            updatedAt: Date.now()
                        });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
                >
                    <Plus size={18} />
                    新規顧客
                </button>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="顧客名・フリガナで検索..."
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
            </div>

            {/* Customer List */}
            {loading ? (
                <div className="text-center text-slate-400 py-8">読み込み中...</div>
            ) : customers.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                    顧客が登録されていません
                </div>
            ) : (
                <div className="space-y-3">
                    {customers.map((customer) => (
                        <div
                            key={customer.id}
                            onClick={() => {
                                setIsCreating(false);
                                setEditingCustomer(customer);
                            }}
                            className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 cursor-pointer transition-colors"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                            {customer.name}
                                        </span>
                                        {customer.paymentType === 'credit' ? (
                                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">
                                                <CreditCard size={12} />
                                                掛売上
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full">
                                                <Banknote size={12} />
                                                現金
                                            </span>
                                        )}
                                    </div>
                                    {customer.nameKana && (
                                        <div className="text-sm text-slate-400">{customer.nameKana}</div>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-1 text-sm text-slate-500">
                                    {customer.phone && (
                                        <div className="flex items-center gap-1">
                                            <Phone size={14} />
                                            {customer.phone}
                                        </div>
                                    )}
                                    {customer.email && (
                                        <div className="flex items-center gap-1">
                                            <Mail size={14} />
                                            {customer.email}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {customer.address && (
                                <div className="mt-2 text-sm text-slate-500">
                                    {customer.address}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            {editingCustomer && (
                <CustomerEditModal
                    customer={editingCustomer}
                    isNew={isCreating}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    onClose={() => {
                        setEditingCustomer(null);
                        setIsCreating(false);
                    }}
                />
            )}
        </div>
    );
};
